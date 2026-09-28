import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CspReporter,
  DEFAULT_CSP_REPORT_ENDPOINT,
  getCspReporter,
  configureCspReporter,
  resetCspReporter,
  normalizeCspViolation,
  sanitizeCspUri,
  shouldSample,
  toCspReportBody,
  installCspReporting,
} from '../cspReporting';

const SECRET_KEY = `S${'A'.repeat(55)}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetCspReporter();
});

describe('cspReporting', () => {
  describe('primary flow', () => {
    it('normalises and stores a violation when sampled in', () => {
      const reporter = new CspReporter({ sampleRate: 1, send: false });
      const listener = vi.fn();
      reporter.subscribe(listener);

      const violation = reporter.report({
        blockedURI: 'https://evil.example.com/tracker.js?u=secret#frag',
        documentURI: 'https://app.example.com/dashboard?token=abc#x',
        violatedDirective: 'script-src',
        effectiveDirective: 'script-src-elem',
        originalPolicy: "script-src 'self'",
        disposition: 'enforce',
        statusCode: 200,
        sourceFile: 'https://app.example.com/app.js?key=zzz',
        lineNumber: 42,
        columnNumber: 7,
      });

      expect(violation).not.toBeNull();
      expect(violation?.blockedUri).toBe('https://evil.example.com/tracker.js');
      expect(violation?.documentUri).toBe('https://app.example.com/dashboard');
      expect(violation?.sourceFile).toBe('https://app.example.com/app.js');
      expect(violation?.lineNumber).toBe(42);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(reporter.getStats()).toMatchObject({ received: 1, recorded: 1, droppedSampled: 0 });
    });

    it('parses the raw kebab-case csp-report JSON shape', () => {
      const violation = normalizeCspViolation({
        'blocked-uri': 'inline',
        'document-uri': '/',
        'violated-directive': 'script-src',
        'source-file': '/app.js',
        'line-number': 3,
      });

      expect(violation?.blockedUri).toBe('inline');
      expect(violation?.violatedDirective).toBe('script-src');
      expect(violation?.lineNumber).toBe(3);
    });
  });

  describe('sanitisation (no sensitive content)', () => {
    it('strips query strings and fragments from URIs', () => {
      expect(sanitizeCspUri('https://app.example.com/p?token=secret#frag')).toBe(
        'https://app.example.com/p',
      );
      expect(sanitizeCspUri('/relative/path?api_key=abc')).toBe('/relative/path');
    });

    it('redacts opaque data/blob URIs and secret-shaped strings', () => {
      expect(sanitizeCspUri('data:text/html;base64,PHNjcmlwdD4=')).toBe('data:[redacted]');
      expect(sanitizeCspUri('blob:https://app.example.com/1234')).toBe('blob:[redacted]');
      expect(sanitizeCspUri(`https://app.example.com/${SECRET_KEY}`)).not.toContain(SECRET_KEY);
      expect(sanitizeCspUri(`https://app.example.com/${SECRET_KEY}`)).toContain('REDACTED');
    });

    it('never includes the browser sample field in the wire body', () => {
      const violation = normalizeCspViolation({
        blockedURI: 'inline',
        violatedDirective: 'script-src',
        sample: 'const password = "hunter2"',
      });
      const body = toCspReportBody(violation!);

      expect(Object.keys(body)).not.toContain('sample');
      expect(Object.keys(body)).not.toContain('script-sample');
      expect(JSON.stringify(body)).not.toContain('hunter2');
      expect(violation).not.toHaveProperty('sample');
    });
  });

  describe('sampling (boundary)', () => {
    it('handles 0, 1, and fractional rates', () => {
      expect(shouldSample(0)).toBe(false);
      expect(shouldSample(1)).toBe(true);
      expect(shouldSample(0.5, () => 0.49)).toBe(true);
      expect(shouldSample(0.5, () => 0.5)).toBe(false);
    });

    it('rejects a non-finite sample rate', () => {
      expect(() => shouldSample(Number.NaN)).toThrow(TypeError);
      expect(() => new CspReporter({ sampleRate: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    });

    it('caps the ring buffer at maxEntries', () => {
      const reporter = new CspReporter({ sampleRate: 1, send: false, maxEntries: 2 });
      for (let i = 0; i < 5; i += 1) {
        reporter.report({ blockedURI: `https://x.example/${i}`, violatedDirective: 'img-src' });
      }
      expect(reporter.getViolations()).toHaveLength(2);
      expect(reporter.getStats().recorded).toBe(5);
    });

    it('drops reports above the sampling threshold', () => {
      const reporter = new CspReporter({ sampleRate: 0.5, send: false, random: () => 0.9 });
      const result = reporter.report({ violatedDirective: 'script-src' });
      expect(result).toBeNull();
      expect(reporter.getStats()).toMatchObject({ received: 1, recorded: 0, droppedSampled: 1 });
    });
  });

  describe('failure paths', () => {
    it('drops invalid input and counts it', () => {
      const reporter = new CspReporter({ sampleRate: 1, send: false });

      expect(reporter.report(null)).toBeNull();
      expect(reporter.report(42)).toBeNull();
      expect(reporter.report({ blockedURI: 'inline' })).toBeNull();
      expect(reporter.getStats()).toMatchObject({ received: 3, recorded: 0, droppedInvalid: 3 });
    });

    it('never throws when dispatch fails', () => {
      vi.stubGlobal('navigator', {
        sendBeacon: vi.fn(() => {
          throw new Error('beacon exploded');
        }),
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      const reporter = new CspReporter({ sampleRate: 1, send: true });
      expect(() => reporter.report({ violatedDirective: 'script-src' })).not.toThrow();
    });

    it('dispatches a sanitised body without sample content', async () => {
      const sendBeacon = vi.fn((_endpoint: string, _body: string | Blob) => true);
      vi.stubGlobal('navigator', { sendBeacon });

      const reporter = new CspReporter({ sampleRate: 1, send: true });
      reporter.report({
        blockedURI: 'inline',
        violatedDirective: 'script-src',
        sample: 'sensitive',
      });

      expect(sendBeacon).toHaveBeenCalledTimes(1);
      const [endpoint, body] = sendBeacon.mock.calls[0];
      expect(endpoint).toBe(DEFAULT_CSP_REPORT_ENDPOINT);
      const text = typeof body === 'string' ? body : await (body as Blob).text();
      expect(text).not.toContain('sample');
      expect(text).not.toContain('sensitive');
    });

    it('is a no-op in unsupported environments', () => {
      vi.stubGlobal('document', undefined);
      const uninstall = installCspReporting(new CspReporter({ sampleRate: 1, send: false }));
      expect(typeof uninstall).toBe('function');
      expect(() => uninstall()).not.toThrow();
    });
  });

  describe('shared reporter registry', () => {
    it('returns a stable default and allows reconfiguration', () => {
      const first = getCspReporter();
      expect(getCspReporter()).toBe(first);

      const configured = configureCspReporter({ sampleRate: 0, send: false });
      expect(getCspReporter()).toBe(configured);
      expect(getCspReporter()).not.toBe(first);
    });
  });
});
