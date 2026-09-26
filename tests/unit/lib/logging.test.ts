import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Logger,
  LogLevel,
  LogLevelNames,
  parseLogLevel,
  createLogger,
  logger,
} from '../../../src/lib/logging';

describe('Structured Logger (#965)', () => {
  let testLogger: Logger;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    testLogger = new Logger({ maxLogs: 100, defaultLevel: LogLevel.DEBUG });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Primary Flow: Logging & Output', () => {
    it('should log messages across all standard log levels', () => {
      testLogger.debug('Debug message', { module: 'auth' });
      testLogger.info('Info message', { count: 42 });
      testLogger.warn('Warning message', { latency: 500 });
      testLogger.error('Error message', { code: 'ERR_TIMEOUT' });
      testLogger.critical('Critical message', { fatal: true });

      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(5);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].message).toBe('Debug message');
      expect(logs[1].level).toBe(LogLevel.INFO);
      expect(logs[1].message).toBe('Info message');
      expect(logs[2].level).toBe(LogLevel.WARN);
      expect(logs[2].message).toBe('Warning message');
      expect(logs[3].level).toBe(LogLevel.ERROR);
      expect(logs[3].message).toBe('Error message');
      expect(logs[4].level).toBe(LogLevel.CRITICAL);
      expect(logs[4].message).toBe('Critical message');
    });

    it('should attach correlation ID, session ID, and custom tags', () => {
      testLogger.setCorrelationId('req-12345');
      testLogger.setSessionId('sess-999');

      testLogger.info('Transaction submitted', { txId: '0xabc' }, ['stellar', 'horizon']);

      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      const entry = logs[0];
      expect(entry.correlationId).toBe('req-12345');
      expect(entry.sessionId).toBe('sess-999');
      expect(entry.tags).toEqual(['stellar', 'horizon']);
      expect(entry.context).toEqual({ txId: '0xabc' });
    });

    it('should notify subscribers on new log entries', () => {
      const subscriber = vi.fn();
      const unsubscribe = testLogger.subscribe(subscriber);

      testLogger.info('Event notification', { detail: 'active' });
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Event notification',
          level: LogLevel.INFO,
        })
      );

      unsubscribe();
      testLogger.info('Post unsubscribe event');
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('should support createLogger namespaced wrapper', () => {
      const nsLogger = createLogger('LedgerWatcher');
      expect(nsLogger.namespace).toBe('LedgerWatcher');
      expect(typeof nsLogger.info).toBe('function');
      expect(typeof nsLogger.warn).toBe('function');
      expect(typeof nsLogger.error).toBe('function');
      expect(typeof nsLogger.debug).toBe('function');
    });

    it('should format exported logs as JSON and formatted text', () => {
      testLogger.info('Export test entry', { key: 'val' });
      const jsonExport = testLogger.exportLogs('json');
      const parsed = JSON.parse(jsonExport);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('Export test entry');

      const textExport = testLogger.exportLogs('text');
      expect(textExport).toContain('[INFO]');
      expect(textExport).toContain('Export test entry');
    });
  });

  describe('Boundary Cases: Ring Buffer & Filtering', () => {
    it('should cap log buffer at maxLogs and trim oldest entries', () => {
      const smallBufferLogger = new Logger({ maxLogs: 5, defaultLevel: LogLevel.DEBUG });
      for (let i = 1; i <= 10; i++) {
        smallBufferLogger.info(`Log index ${i}`);
      }

      const logs = smallBufferLogger.getLogs();
      expect(logs).toHaveLength(5);
      expect(logs[0].message).toBe('Log index 6');
      expect(logs[4].message).toBe('Log index 10');
    });

    it('should filter logs by level, tag, correlationId, and search query', () => {
      testLogger.debug('Connection initialized', { host: 'stellar.org' }, ['net']);
      testLogger.info('Payment processed', { amount: 100 }, ['tx', 'payment']);
      testLogger.warn('High memory usage', { mem: '95%' }, ['perf']);
      testLogger.error('RPC server unreachable', { retry: 3 }, ['net', 'error']);

      // Filter by min level WARN
      const warnAndAbove = testLogger.getLogs({ level: LogLevel.WARN });
      expect(warnAndAbove).toHaveLength(2);
      expect(warnAndAbove.map(l => l.message)).toEqual([
        'High memory usage',
        'RPC server unreachable',
      ]);

      // Filter by tag
      const netLogs = testLogger.getLogs({ tags: ['net'] });
      expect(netLogs).toHaveLength(2);

      // Filter by search substring
      const searchLogs = testLogger.getLogs({ search: 'Payment' });
      expect(searchLogs).toHaveLength(1);
      expect(searchLogs[0].message).toBe('Payment processed');
    });

    it('should handle clearing logs cleanly', () => {
      testLogger.info('To be cleared');
      expect(testLogger.getLogs()).toHaveLength(1);

      testLogger.clearLogs();
      expect(testLogger.getLogs()).toHaveLength(0);
    });

    it('should parse log levels from numbers and case-insensitive strings', () => {
      expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
      expect(parseLogLevel('INFO')).toBe(LogLevel.INFO);
      expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
      expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
      expect(parseLogLevel('critical')).toBe(LogLevel.CRITICAL);
      expect(parseLogLevel('2')).toBe(LogLevel.WARN);
      expect(parseLogLevel('unknown_level')).toBeUndefined();
    });
  });

  describe('Security & Sensitive Data Redaction (#774 / #965)', () => {
    it('should redact Stellar Secret Keys (S...) in log messages', () => {
      const secretKey = 'SC234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP';
      testLogger.error(`Failed to sign with key: ${secretKey}`);

      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).not.toContain(secretKey);
      expect(logs[0].message).toContain('[REDACTED_SECRET_KEY]');
    });

    it('should redact Bearer authorization tokens', () => {
      testLogger.warn('Failed API call with header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz');

      const logs = testLogger.getLogs();
      expect(logs[0].message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz');
      expect(logs[0].message).toContain('Bearer [REDACTED]');
    });

    it('should redact sensitive keys in context objects', () => {
      testLogger.info('User session payload', {
        username: 'alice',
        password: 'SuperSecretPassword123!',
        privateKey: 'private-key-value',
        apiKey: 'sk_live_1234567890',
        token: 'auth-token-secret',
        nested: {
          secret: 'nested-secret-value',
          seed: 'word1 word2 word3 word4',
        },
      });

      const logs = testLogger.getLogs();
      const ctx = logs[0].context as Record<string, unknown>;
      expect(ctx.username).toBe('alice');
      expect(ctx.password).toBe('[REDACTED]');
      expect(ctx.privateKey).toBe('[REDACTED]');
      expect(ctx.apiKey).toBe('[REDACTED]');
      expect(ctx.token).toBe('[REDACTED]');

      const nested = ctx.nested as Record<string, unknown>;
      expect(nested.secret).toBe('[REDACTED]');
      expect(nested.seed).toBe('[REDACTED]');
    });

    it('should not throw or disrupt logging when a subscriber fails', () => {
      const brokenSubscriber = vi.fn().mockImplementation(() => {
        throw new Error('Subscriber exploded');
      });
      testLogger.subscribe(brokenSubscriber);

      expect(() => {
        testLogger.info('Safe execution test');
      }).not.toThrow();

      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Safe execution test');
    });
  });

  describe('Environment Configuration & Production Default Level', () => {
    it('should default to LogLevel.WARN in production environment', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new Logger();

      expect(prodLogger.getLogLevel()).toBe(LogLevel.WARN);
    });

    it('should strip/drop debug and info logs in production level', () => {
      const prodLogger = new Logger({ defaultLevel: LogLevel.WARN });
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      prodLogger.debug('Debug log that should be dropped');
      prodLogger.info('Info log that should be dropped');
      prodLogger.warn('Warning log that should be kept');
      prodLogger.error('Error log that should be kept');

      const logs = prodLogger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[0].message).toBe('Warning log that should be kept');
      expect(logs[1].level).toBe(LogLevel.ERROR);
      expect(logs[1].message).toBe('Error log that should be kept');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should dynamically update log level via setLogLevel / setLevel', () => {
      const dynamicLogger = new Logger({ defaultLevel: LogLevel.WARN });
      dynamicLogger.info('Ignored initial info');
      expect(dynamicLogger.getLogs()).toHaveLength(0);

      dynamicLogger.setLogLevel(LogLevel.INFO);
      dynamicLogger.info('Accepted info after level update');
      expect(dynamicLogger.getLogs()).toHaveLength(1);

      dynamicLogger.setLevel('ERROR');
      dynamicLogger.warn('Ignored warn after bumping to ERROR');
      expect(dynamicLogger.getLogs()).toHaveLength(1);

      dynamicLogger.error('Accepted error');
      expect(dynamicLogger.getLogs()).toHaveLength(2);
    });
  });
});
