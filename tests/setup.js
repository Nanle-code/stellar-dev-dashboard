import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server';

// ─── MSW Horizon mock server (#171) ───────────────────────────────────────────
// By default all tests run against the MSW mock layer, not live Horizon.
// Set STELLAR_E2E_LIVE=1 in your environment to skip MSW and hit the real network.
if (!process.env.STELLAR_E2E_LIVE) {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

// ─── localStorage mock ────────────────────────────────────────────────────────
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] ?? null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
};

// ─── navigator.clipboard mock ─────────────────────────────────────────────────
if (typeof navigator !== 'undefined') {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
} else {
  global.navigator = {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  };
}

// ─── window.matchMedia mock ─────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ─── Stellar SDK mock ─────────────────────────────────────────────────────────
vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual('@stellar/stellar-sdk');
  return {
    ...actual,
    // Keep real SDK but allow individual tests to override
  };
});

// ─── Suppress noisy console output in tests ───────────────────────────────────
global.console.warn = vi.fn();

// ─── Stub HTMLCanvasElement.getContext for environments without canvas package
try {
  if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = function () {
      return {
        getContextAttributes: () => ({}),
        getExtension: () => null,
        canvas: this,
        // minimal 2D context stubs used by some libs
        fillRect: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: [] }),
        putImageData: () => {},
        createImageData: () => [],
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
      };
    };
  }
} catch (e) {
  // ignore
}
