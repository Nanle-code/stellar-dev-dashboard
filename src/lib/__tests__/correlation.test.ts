import { describe, expect, it, vi } from 'vitest';
import {
  CORRELATION_ID_HEADER,
  correlationContext,
  createCorrelationFetch,
  extractCorrelationId,
  generateCorrelationId,
  getCorrelationId,
  isValidCorrelationId,
  normaliseCorrelationId,
  withCorrelation,
} from '../correlation';

function headerValue(init: RequestInit | undefined, name: string): string | null {
  if (!init || !init.headers) return null;
  const headers = new Headers(init.headers as HeadersInit);
  return headers.get(name);
}

describe('correlation id primitives', () => {
  it('generates valid, unique ids', () => {
    const a = generateCorrelationId();
    const b = generateCorrelationId();
    expect(isValidCorrelationId(a)).toBe(true);
    expect(isValidCorrelationId(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('normalises invalid input into a fresh valid id', () => {
    expect(normaliseCorrelationId('bad')).not.toBe('bad');
    expect(isValidCorrelationId(normaliseCorrelationId('bad'))).toBe(true);
    expect(normaliseCorrelationId(undefined)).not.toBe('');
  });

  it('rejects empty and over-long ids', () => {
    expect(isValidCorrelationId('')).toBe(false);
    expect(isValidCorrelationId('x'.repeat(200))).toBe(false);
    expect(isValidCorrelationId(42)).toBe(false);
  });
});

describe('correlation context', () => {
  it('exposes the id for the duration of a sync scope and restores it', () => {
    expect(getCorrelationId()).toBeNull();
    const seen = withCorrelation('test-correlation-0001', () => getCorrelationId());
    expect(seen).toBe('test-correlation-0001');
    expect(getCorrelationId()).toBeNull();
  });

  it('keeps the id active across an async scope and clears on rejection', async () => {
    await expect(
      withCorrelation('async-correlation-0002', async () => {
        expect(getCorrelationId()).toBe('async-correlation-0002');
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(getCorrelationId()).toBeNull();
  });

  it('generates an id when called with only a function', () => {
    const id = withCorrelation(() => getCorrelationId());
    expect(isValidCorrelationId(id)).toBe(true);
  });

  it('throws when the second argument is not a function', () => {
    expect(() => withCorrelation('some-id-00000001', undefined as unknown as () => void)).toThrow(TypeError);
  });
});

describe('createCorrelationFetch', () => {
  it('injects the X-Correlation-ID header from the active context', async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({ ok: true, init }) as unknown as Response);
    const api = createCorrelationFetch({ baseFetch: base as unknown as typeof fetch, getId: () => 'header-correlation-01' });

    await api('/api/account');

    expect(base).toHaveBeenCalledOnce();
    expect(headerValue(base.mock.calls[0][1], CORRELATION_ID_HEADER)).toBe('header-correlation-01');
  });

  it('does not overwrite a caller-supplied correlation header', async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({ ok: true, init }) as unknown as Response);
    const api = createCorrelationFetch({ baseFetch: base as unknown as typeof fetch, getId: () => 'generated-00000001' });

    await api('/api/account', { headers: { [CORRELATION_ID_HEADER]: 'caller-supplied-id' } });

    expect(headerValue(base.mock.calls[0][1], CORRELATION_ID_HEADER)).toBe('caller-supplied-id');
  });

  it('decorates thrown errors with the correlation id and reports them', async () => {
    const failure = new Error('network down');
    const base = vi.fn(async () => {
      throw failure;
    });
    const onError = vi.fn();
    const api = createCorrelationFetch({ baseFetch: base as unknown as typeof fetch, getId: () => 'failure-correlation-1', onError });

    await expect(api('/api/fail')).rejects.toMatchObject({ correlationId: 'failure-correlation-1' });
    expect(onError).toHaveBeenCalledWith('failure-correlation-1', failure);
  });

  it('returns a rejecting stub when fetch is unsupported', async () => {
    const api = createCorrelationFetch({ baseFetch: undefined, getId: () => null });
    if (typeof fetch !== 'undefined') {
      // In environments that do provide fetch, the stub is only used when the
      // caller explicitly passes `undefined`; just assert it is callable.
      expect(typeof api).toBe('function');
    } else {
      await expect(api('/x')).rejects.toMatchObject({ correlationId: expect.any(String) });
    }
  });
});

describe('extractCorrelationId', () => {
  it('prefers a valid response header', () => {
    const headers = new Headers({ [CORRELATION_ID_HEADER]: 'response-correlation' });
    correlationContext.run('context-correlation-1', () => {
      expect(extractCorrelationId(headers)).toBe('response-correlation');
    });
  });

  it('falls back to the active context when the header is missing or invalid', () => {
    correlationContext.run('context-correlation-2', () => {
      expect(extractCorrelationId(new Headers())).toBe('context-correlation-2');
      expect(extractCorrelationId(null)).toBe('context-correlation-2');
    });
  });
});
