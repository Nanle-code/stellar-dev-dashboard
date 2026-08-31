import { describe, it, expect, vi } from 'vitest';
import {
  HorizonPaginator,
  createHorizonPaginator,
  isValidCursor,
  validateCursor,
  validateHorizonUrl,
  type FetchPageResult,
  type HorizonRecord,
} from '../horizonPagination';

const FAST_RETRY = { maxRetries: 3, baseDelay: 1, maxDelay: 5, jitter: false };

function page(tokens: string[]): FetchPageResult<HorizonRecord> {
  return { records: tokens.map(t => ({ paging_token: t, id: t })) };
}

function rateLimitError() {
  return { response: { status: 429 }, message: 'Too Many Requests' };
}

function serverError() {
  return { response: { status: 503 }, message: 'Service Unavailable' };
}

describe('horizonPagination', () => {
  describe('cursor & URL validation', () => {
    it('accepts numeric tokens, "now", and rejects malformed cursors', () => {
      expect(isValidCursor('12884901888')).toBe(true);
      expect(isValidCursor('now')).toBe(true);
      expect(isValidCursor('')).toBe(false);
      expect(isValidCursor('has spaces')).toBe(false);
      expect(isValidCursor('bad;token')).toBe(false);
      expect(isValidCursor(123)).toBe(false);
    });

    it('validateCursor passes through null/undefined and valid cursors', () => {
      expect(validateCursor(null)).toBeNull();
      expect(validateCursor(undefined)).toBeNull();
      expect(validateCursor('42')).toBe('42');
    });

    it('validateCursor throws on an invalid cursor', () => {
      expect(() => validateCursor('not valid!')).toThrow(/Invalid Horizon cursor/);
    });

    it('validateHorizonUrl accepts https and localhost http, rejects the rest', () => {
      expect(() => validateHorizonUrl('https://horizon-testnet.stellar.org')).not.toThrow();
      expect(() => validateHorizonUrl('http://localhost:8000')).not.toThrow();
      expect(() => validateHorizonUrl('http://example.com')).toThrow(/must use https/);
      expect(() => validateHorizonUrl('not-a-url')).toThrow(/Invalid Horizon URL/);
    });

    it('validateHorizonUrl enforces an allow-list of hosts when provided', () => {
      expect(() =>
        validateHorizonUrl('https://horizon.stellar.org', ['horizon-testnet.stellar.org']),
      ).toThrow(/not in the allowed host list/);
      expect(() =>
        validateHorizonUrl('https://horizon-testnet.stellar.org', ['horizon-testnet.stellar.org']),
      ).not.toThrow();
    });
  });

  describe('constructor validation', () => {
    const noopFetch = async () => page([]);

    it('rejects an out-of-range limit', () => {
      expect(() => new HorizonPaginator(noopFetch, { limit: 0 })).toThrow(/page limit/);
      expect(() => new HorizonPaginator(noopFetch, { limit: 500 })).toThrow(/page limit/);
    });

    it('rejects an invalid order', () => {
      // @ts-expect-error intentionally invalid order for validation test
      expect(() => new HorizonPaginator(noopFetch, { order: 'sideways' })).toThrow(/Invalid page order/);
    });

    it('rejects an invalid initial cursor', () => {
      expect(() => new HorizonPaginator(noopFetch, { initialCursor: 'bad cursor' })).toThrow(
        /Invalid Horizon cursor/,
      );
    });

    it('validates horizonUrl when provided', () => {
      expect(() => new HorizonPaginator(noopFetch, { horizonUrl: 'ftp://bad' })).toThrow(/must use https/);
    });
  });

  describe('primary flow: multi-page streaming and resumption', () => {
    it('streams multiple pages, advancing the cursor as it goes', async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce(page(['1', '2']))
        .mockResolvedValueOnce(page(['3']));

      const paginator = createHorizonPaginator(fetchPage, { limit: 2 });
      const records = await paginator.collect();

      expect(records.map(r => r.paging_token)).toEqual(['1', '2', '3']);
      expect(paginator.getCursor()).toBe('3');
      expect(paginator.isDone()).toBe(true);
      expect(fetchPage).toHaveBeenCalledTimes(2);
      expect(fetchPage).toHaveBeenNthCalledWith(1, { cursor: null, limit: 2, order: 'asc' });
      expect(fetchPage).toHaveBeenNthCalledWith(2, { cursor: '2', limit: 2, order: 'asc' });
    });

    it('resumes from a saved cursor checkpoint on a fresh paginator instance', async () => {
      const firstRun = vi.fn().mockResolvedValueOnce(page(['1', '2']));
      const first = createHorizonPaginator(firstRun, { limit: 2 });
      await first.nextPage();
      const checkpoint = first.getCursor();
      expect(checkpoint).toBe('2');

      const secondRun = vi.fn().mockResolvedValueOnce(page(['3', '4'])).mockResolvedValueOnce(page([]));
      const resumed = createHorizonPaginator(secondRun, { limit: 2, initialCursor: checkpoint });
      const rest = await resumed.collect();

      expect(rest.map(r => r.paging_token)).toEqual(['3', '4']);
      expect(secondRun).toHaveBeenNthCalledWith(1, { cursor: '2', limit: 2, order: 'asc' });
    });

    it('resumeFromCursor() lets an existing paginator jump to a new checkpoint', async () => {
      const fetchPage = vi.fn().mockResolvedValueOnce(page(['9', '10']));
      const paginator = createHorizonPaginator(fetchPage, { limit: 2, initialCursor: '1' });

      paginator.resumeFromCursor('8');
      await paginator.nextPage();

      expect(fetchPage).toHaveBeenCalledWith({ cursor: '8', limit: 2, order: 'asc' });
    });
  });

  describe('boundary cases: empty and terminal pages', () => {
    it('marks the paginator done on an empty page and stops calling fetchPage', async () => {
      const fetchPage = vi.fn().mockResolvedValue(page([]));
      const paginator = createHorizonPaginator(fetchPage, { limit: 5 });

      const first = await paginator.nextPage();
      expect(first).toEqual([]);
      expect(paginator.isDone()).toBe(true);

      const second = await paginator.nextPage();
      expect(second).toEqual([]);
      expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('treats a short final page (< limit) as the end of the collection', async () => {
      const fetchPage = vi.fn().mockResolvedValueOnce(page(['1', '2', '3']));
      const paginator = createHorizonPaginator(fetchPage, { limit: 5 });

      const records = await paginator.nextPage();
      expect(records).toHaveLength(3);
      expect(paginator.isDone()).toBe(true);
      expect(paginator.getCursor()).toBe('3');

      await paginator.nextPage();
      expect(fetchPage).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure path: retries and cursor integrity', () => {
    it('retries a 429 and succeeds, keeping the cursor consistent', async () => {
      const fetchPage = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError())
        .mockResolvedValueOnce(page(['1', '2']));

      const paginator = createHorizonPaginator(fetchPage, { limit: 2, retry: FAST_RETRY });
      const records = await paginator.nextPage();

      expect(records.map(r => r.paging_token)).toEqual(['1', '2']);
      expect(paginator.getCursor()).toBe('2');
      expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it('retries repeated 503s up to the retry budget then surfaces the error', async () => {
      const fetchPage = vi.fn().mockRejectedValue(serverError());
      const paginator = createHorizonPaginator(fetchPage, {
        limit: 2,
        initialCursor: '5',
        retry: FAST_RETRY,
      });

      await expect(paginator.nextPage()).rejects.toMatchObject({ response: { status: 503 } });
      // The last valid cursor checkpoint must survive the failed fetch.
      expect(paginator.getCursor()).toBe('5');
      expect(fetchPage).toHaveBeenCalledTimes(FAST_RETRY.maxRetries);
    });

    it('does not retry a non-retryable 400 and preserves the cursor', async () => {
      const fetchPage = vi.fn().mockRejectedValue({ response: { status: 400 }, message: 'Bad Request' });
      const paginator = createHorizonPaginator(fetchPage, {
        limit: 2,
        initialCursor: '5',
        retry: FAST_RETRY,
      });

      await expect(paginator.nextPage()).rejects.toMatchObject({ response: { status: 400 } });
      expect(paginator.getCursor()).toBe('5');
      expect(fetchPage).toHaveBeenCalledTimes(1);
    });
  });
});
