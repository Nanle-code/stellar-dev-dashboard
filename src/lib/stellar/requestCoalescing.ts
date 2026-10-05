/**
 * Single-flight helpers for identical, concurrent Horizon GET requests.
 * Results are shared only until the underlying request settles; this is not a cache.
 */

type Flight<T> = {
  promise: Promise<T>;
  controller?: AbortController;
  subscribers: number;
  settled: boolean;
};

const flights = new Map<string, Flight<unknown>>();
const sdkClientIds = new WeakMap<object, number>();
let nextSdkClientId = 1;

function stableSerialize(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  if (seen.has(value)) return '"[circular]"';
  seen.add(value);
  if (Array.isArray(value)) {
    const serialized = `[${value.map((item) => stableSerialize(item, seen)).join(',')}]`;
    seen.delete(value);
    return serialized;
  }
  const record = value as Record<string, unknown>;
  const serialized = `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key], seen)}`)
    .join(',')}}`;
  seen.delete(value);
  return serialized;
}

function normalizeHeaders(headers: HeadersInit | undefined): Array<[string, string]> {
  if (!headers) return [];
  let entries: Array<[string, string]>;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    entries = Array.from(headers.entries());
  } else if (Array.isArray(headers)) {
    entries = headers.map(([key, value]) => [String(key), String(value)]);
  } else {
    entries = Object.entries(headers).map(([key, value]) => [key, String(value)]);
  }
  return entries
    .map(([key, value]): [string, string] => [key.toLowerCase(), value])
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
}

export function createHorizonFetchKey(
  url: string,
  options: RequestInit = {},
  requestContext?: unknown
): string | null {
  if (typeof url !== 'string' || !url.trim()) {
    throw new TypeError('Horizon request URL must be a non-empty string.');
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('Horizon request options must be an object.');
  }
  const rawMethod = options.method || 'GET';
  if (typeof rawMethod !== 'string') {
    throw new TypeError('Horizon request method must be a string.');
  }
  const method = rawMethod.toUpperCase();
  if (method !== 'GET' || (options.body !== undefined && options.body !== null)) return null;
  if (typeof URL === 'undefined') {
    throw new Error('Horizon request coalescing requires the URL API.');
  }
  try {
    const normalizedUrl = new URL(url).toString();
    const { signal: _signal, headers: _headers, method: _method, ...requestOptions } = options;
    return `horizon-fetch:${stableSerialize({
      url: normalizedUrl,
      method,
      headers: normalizeHeaders(options.headers),
      options: requestOptions,
      requestContext,
    })}`;
  } catch (error) {
    throw new TypeError(`Invalid Horizon request URL: ${String(error)}`);
  }
}

/**
 * Share one in-flight operation among matching callers. Each caller's abort
 * rejects only that caller; the transport aborts once all subscribers leave.
 */
export function coalesceRequest<T>(
  key: string,
  operation: (_signal?: AbortSignal) => Promise<T>,
  callerSignal?: AbortSignal
): Promise<T> {
  if (typeof Promise === 'undefined') {
    throw new Error('Horizon request coalescing requires Promise support.');
  }
  if (typeof key !== 'string' || !key.trim()) {
    throw new TypeError('Horizon request coalescing key must be a non-empty string.');
  }
  if (typeof operation !== 'function') {
    throw new TypeError('Horizon request coalescing requires an operation function.');
  }
  if (callerSignal?.aborted) {
    return Promise.reject(createAbortError());
  }

  let flight = flights.get(key) as Flight<T> | undefined;
  if (!flight) {
    const controller = typeof AbortController === 'undefined' ? undefined : new AbortController();
    const created: Flight<T> = {
      promise: Promise.resolve().then(() => operation(controller?.signal)),
      controller,
      subscribers: 0,
      settled: false,
    };
    flight = created;
    flights.set(key, created as Flight<unknown>);
    const settle = () => {
      created.settled = true;
      if (flights.get(key) === created) flights.delete(key);
    };
    void created.promise.then(settle, settle);
  }

  flight.subscribers += 1;
  return new Promise<T>((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      callerSignal?.removeEventListener('abort', onAbort);
      flight!.subscribers -= 1;
      if (!flight!.settled && flight!.subscribers === 0) {
        if (flights.get(key) === flight) flights.delete(key);
        flight!.controller?.abort();
      }
    };
    const onAbort = () => {
      release();
      reject(createAbortError());
    };

    callerSignal?.addEventListener('abort', onAbort, { once: true });
    flight!.promise.then(
      (result) => {
        if (released) return;
        release();
        resolve(result);
      },
      (error) => {
        if (released) return;
        release();
        reject(error);
      }
    );
  });
}

/** Fetch a Horizon GET once and give every waiter its own consumable Response. */
export function coalescedHorizonFetch(
  url: string,
  options: RequestInit = {},
  fetcher?: typeof fetch
): Promise<Response> {
  const key = createHorizonFetchKey(url, options);
  if (typeof Promise === 'undefined') {
    throw new Error('Horizon request coalescing requires Promise support.');
  }
  const activeFetcher = fetcher ?? globalThis.fetch;
  if (typeof activeFetcher !== 'function') {
    throw new Error('Horizon requests require a fetch implementation in this environment.');
  }
  if (!key) return activeFetcher(url, options);
  const callerSignal = options.signal ?? undefined;
  return coalesceRequest(
    key,
    (sharedSignal) => {
      const sharedOptions = { ...options, signal: sharedSignal };
      return activeFetcher(url, sharedOptions);
    },
    callerSignal
  ).then((response) => (typeof response.clone === 'function' ? response.clone() : response));
}

/** Add GET coalescing to one Stellar SDK HttpClient, preserving its normal adapter. */
export function installSdkGetCoalescing<
  T extends {
    get: (_url: string, _config?: Record<string, any>) => Promise<any>;
    defaults?: { headers?: unknown; baseURL?: string };
    interceptors?: { request?: { handlers?: unknown[] }; response?: { handlers?: unknown[] } };
  },
>(client: T, sharedScope?: string): T {
  const originalGet = client.get;
  const baselineRequestInterceptors = client.interceptors?.request?.handlers.slice() ?? [];
  const baselineResponseInterceptors = client.interceptors?.response?.handlers.slice() ?? [];
  let clientId = sdkClientIds.get(client);
  if (!clientId) {
    clientId = nextSdkClientId++;
    sdkClientIds.set(client, clientId);
  }
  client.get = function coalescedGet(url: string, config: Record<string, any> = {}) {
    const currentRequestInterceptors = client.interceptors?.request?.handlers ?? [];
    const currentResponseInterceptors = client.interceptors?.response?.handlers ?? [];
    const interceptorsUnchanged =
      baselineRequestInterceptors.length === currentRequestInterceptors.length &&
      baselineResponseInterceptors.length === currentResponseInterceptors.length &&
      baselineRequestInterceptors.every(
        (handler, index) => handler === currentRequestInterceptors[index]
      ) &&
      baselineResponseInterceptors.every(
        (handler, index) => handler === currentResponseInterceptors[index]
      );
    if (
      !interceptorsUnchanged ||
      config.cancelToken ||
      config.signal ||
      config.adapter ||
      config.paramsSerializer ||
      (config.responseType && config.responseType !== 'json') ||
      (config.method && String(config.method).toUpperCase() !== 'GET')
    ) {
      return originalGet.call(client, url, config);
    }

    const key = `horizon-sdk:${stableSerialize({
      clientScope: sharedScope ?? clientId,
      url,
      baseURL: config.baseURL ?? client.defaults?.baseURL,
      params: config.params,
      headers: {
        defaults: client.defaults?.headers,
        request: config.headers,
      },
      timeout: config.timeout,
      responseType: config.responseType,
      withCredentials: config.withCredentials,
      auth: config.auth,
      fetchOptions: config.fetchOptions,
      maxContentLength: config.maxContentLength,
      maxRedirects: config.maxRedirects,
    })}`;
    return coalesceRequest(key, () => originalGet.call(client, url, config)).then(cloneSdkResponse);
  } as T['get'];
  return client;
}

function cloneSdkResponse<T>(response: T): T {
  if (!response || typeof response !== 'object' || !('data' in response)) return response;
  const sdkResponse = response as T & { data: unknown };
  const clonedData =
    sdkResponse.data === undefined ? undefined : JSON.parse(JSON.stringify(sdkResponse.data));
  return { ...sdkResponse, data: clonedData };
}

function createAbortError(): Error {
  if (typeof DOMException === 'function')
    return new DOMException('The operation was aborted.', 'AbortError');
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

export function resetHorizonRequestCoalescingForTests(): void {
  for (const flight of flights.values()) flight.controller?.abort();
  flights.clear();
}
