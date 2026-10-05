import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimiter } from '../../rateLimiter';
import {
  coalesceRequest,
  coalescedHorizonFetch,
  createHorizonFetchKey,
  installSdkGetCoalescing,
  resetHorizonRequestCoalescingForTests,
} from '../requestCoalescing';
import { rateLimitedFetch } from '../networks';

beforeEach(() => {
  resetHorizonRequestCoalescingForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Horizon request coalescing', () => {
  it('shares three concurrent identical GET requests and gives each caller its own response body', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    const url = 'https://horizon-testnet.stellar.org/accounts/GABC?limit=2';
    const requests = [1, 2, 3].map(() =>
      coalescedHorizonFetch(url, { headers: { Accept: 'application/json' } }, fetcher)
    );
    await Promise.resolve();
    finish(new Response(JSON.stringify({ records: [1, 2] })));
    const [first, second, third] = await Promise.all(requests);

    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(first.json()).resolves.toEqual({ records: [1, 2] });
    await expect(second.json()).resolves.toEqual({ records: [1, 2] });
    await expect(third.json()).resolves.toEqual({ records: [1, 2] });
  });

  it('starts a new network request after the first request settles', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const url = 'https://horizon-testnet.stellar.org/accounts/GABC';

    await coalescedHorizonFetch(url, {}, fetcher);
    await coalescedHorizonFetch(url, {}, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects all concurrent callers on failure and clears the in-flight entry', async () => {
    let fail!: (error: Error) => void;
    const operation = vi.fn(
      () =>
        new Promise<string>((_resolve, reject) => {
          fail = reject;
        })
    );
    const first = coalesceRequest('shared-failure', operation);
    const second = coalesceRequest('shared-failure', operation);
    const third = coalesceRequest('shared-failure', operation);
    await Promise.resolve();
    fail(new Error('Horizon offline'));

    const results = await Promise.allSettled([first, second, third]);
    expect(results).toEqual([
      { status: 'rejected', reason: expect.objectContaining({ message: 'Horizon offline' }) },
      { status: 'rejected', reason: expect.objectContaining({ message: 'Horizon offline' }) },
      { status: 'rejected', reason: expect.objectContaining({ message: 'Horizon offline' }) },
    ]);
    expect(operation).toHaveBeenCalledTimes(1);
    await expect(coalesceRequest('shared-failure', async () => 'retried')).resolves.toBe('retried');
  });

  it('does not coalesce mutations, differing request headers, or invalid URLs', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const url = 'https://horizon-testnet.stellar.org/accounts/GABC';

    expect(() => createHorizonFetchKey('not a URL')).toThrow(/Invalid Horizon request URL/);
    expect(() => createHorizonFetchKey('  ')).toThrow(/non-empty string/);
    expect(createHorizonFetchKey(url, { method: 'POST' })).toBeNull();
    expect(createHorizonFetchKey(url, {}, 'high')).not.toBe(createHorizonFetchKey(url, {}, 'low'));
    await Promise.all([
      coalescedHorizonFetch(url, { headers: { Authorization: 'Bearer user-a' } }, fetcher),
      coalescedHorizonFetch(url, { headers: { Authorization: 'Bearer user-b' } }, fetcher),
      coalescedHorizonFetch(url, { method: 'POST' }, fetcher),
      coalescedHorizonFetch(url, { method: 'POST' }, fetcher),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('reports a clear error when fetch is unavailable', () => {
    vi.stubGlobal('fetch', undefined);
    expect(() =>
      coalescedHorizonFetch('https://horizon-testnet.stellar.org/accounts/GABC')
    ).toThrow(/fetch implementation/);
  });

  it('clears rejected in-flight work so later callers can retry', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Horizon offline'))
      .mockResolvedValueOnce('recovered');

    await expect(coalesceRequest('retry-key', operation)).rejects.toThrow('Horizon offline');
    await expect(coalesceRequest('retry-key', operation)).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not cancel another waiter when one caller aborts', async () => {
    let finish!: (value: string) => void;
    let sharedSignal: AbortSignal | undefined;
    const operation = vi.fn((signal?: AbortSignal) => {
      sharedSignal = signal;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });
    const firstController = new AbortController();
    const first = coalesceRequest('abort-key', operation, firstController.signal);
    const second = coalesceRequest('abort-key', operation);
    firstController.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(sharedSignal?.aborted).toBe(false);
    finish('still available');
    await expect(second).resolves.toBe('still available');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('coalesces the SDK GET method but preserves SDK POST calls', async () => {
    let resolveGet!: (value: { data: { records: Array<{ parsed: boolean }> } }) => void;
    const client = {
      defaults: { headers: { common: { Accept: 'application/json' } } },
      interceptors: { request: { handlers: [] }, response: { handlers: [] } },
      get: vi.fn(
        (_url: string, _config?: Record<string, any>) =>
          new Promise<{ data: { records: Array<{ parsed: boolean }> } }>((resolve) => {
            resolveGet = resolve;
          })
      ),
      post: vi.fn().mockResolvedValue({ data: 'posted' }),
    };
    const originalGet = client.get;
    installSdkGetCoalescing(client);

    const first = client.get('https://horizon.stellar.org/accounts/GABC');
    const second = client.get('https://horizon.stellar.org/accounts/GABC');
    await Promise.resolve();
    resolveGet({ data: { records: [{ parsed: false }] } });
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    firstResponse.data.records[0].parsed = true;
    expect(secondResponse.data.records[0].parsed).toBe(false);
    expect(originalGet).toHaveBeenCalledTimes(1);

    await client.post('https://horizon.stellar.org/transactions');
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('coalesces the same GET across equivalent Horizon SDK clients', async () => {
    let complete!: (response: { data: { records: number[] } }) => void;
    const createClient = () => ({
      defaults: { headers: { 'X-Client-Name': 'dashboard' } },
      get: vi.fn(
        (_url: string, _config?: Record<string, any>) =>
          new Promise<{ data: { records: number[] } }>((resolve) => {
            complete = resolve;
          })
      ),
    });
    const firstClient = createClient();
    const secondClient = createClient();
    const firstGet = firstClient.get;
    const secondGet = secondClient.get;
    installSdkGetCoalescing(firstClient, 'same-horizon-endpoint');
    installSdkGetCoalescing(secondClient, 'same-horizon-endpoint');

    const first = firstClient.get('https://horizon-testnet.stellar.org/accounts/GABC');
    const second = secondClient.get('https://horizon-testnet.stellar.org/accounts/GABC');
    await Promise.resolve();
    complete({ data: { records: [1] } });
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstGet).toHaveBeenCalledTimes(1);
    expect(secondGet).toHaveBeenCalledTimes(0);
    firstResult.data.records.push(2);
    expect(secondResult.data.records).toEqual([1]);
  });

  it('does not coalesce an SDK client after custom interceptors are added', async () => {
    const client = {
      defaults: {},
      interceptors: {
        request: { handlers: [] as unknown[] },
        response: { handlers: [] as unknown[] },
      },
      get: vi.fn((_url: string, _config?: Record<string, any>) =>
        Promise.resolve({ data: 'result' })
      ),
    };
    const originalGet = client.get;
    installSdkGetCoalescing(client, 'custom-interceptor-test');
    client.interceptors.request.handlers.push({ fulfilled: (config: unknown) => config });

    await Promise.all([
      client.get('https://horizon.stellar.org/accounts/GABC'),
      client.get('https://horizon.stellar.org/accounts/GABC'),
    ]);

    expect(originalGet).toHaveBeenCalledTimes(2);
  });

  it('coalesces rate-limited Horizon fetches before consuming rate-limit tokens', async () => {
    const rateCheck = vi
      .spyOn(rateLimiter, 'checkRequest')
      .mockReturnValue({ allowed: true, remaining: 10 });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}'));
    const url = 'https://horizon-testnet.stellar.org/accounts/GABC';

    const [first, second] = await Promise.all([
      rateLimitedFetch(url, { headers: { Accept: 'application/json' } }),
      rateLimitedFetch(url, { headers: { accept: 'application/json' } }),
    ]);

    expect(rateCheck).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(first.json()).resolves.toEqual({ ok: true });
    await expect(second.json()).resolves.toEqual({ ok: true });

    await Promise.all([
      rateLimitedFetch('https://example.com/accounts/GABC'),
      rateLimitedFetch('https://example.com/accounts/GABC'),
    ]);
    expect(rateCheck).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
