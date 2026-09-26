import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_STORAGE_KEY,
  MAX_IDLE_TIMEOUT_MINUTES,
  MIN_IDLE_TIMEOUT_MINUTES,
  createIdleSessionMonitor,
  getWarningLeadMs,
  isIdleTimeoutSupported,
  loadIdleTimeoutMinutes,
  normalizeIdleTimeoutMinutes,
  saveIdleTimeoutMinutes,
} from '../idleTimeout';

const MINUTE = 60_000;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe('normalizeIdleTimeoutMinutes', () => {
  it('accepts in-range integers and numeric strings', () => {
    expect(normalizeIdleTimeoutMinutes(15)).toEqual({ minutes: 15, valid: true });
    expect(normalizeIdleTimeoutMinutes('30')).toEqual({ minutes: 30, valid: true });
  });

  it('treats 0 as disabled', () => {
    expect(normalizeIdleTimeoutMinutes(0)).toEqual({ minutes: 0, valid: true });
  });

  it('accepts the exact range boundaries', () => {
    expect(normalizeIdleTimeoutMinutes(MIN_IDLE_TIMEOUT_MINUTES).valid).toBe(true);
    expect(normalizeIdleTimeoutMinutes(MAX_IDLE_TIMEOUT_MINUTES).valid).toBe(true);
  });

  it('clamps values just outside the range', () => {
    expect(normalizeIdleTimeoutMinutes(0.2)).toMatchObject({ minutes: MIN_IDLE_TIMEOUT_MINUTES, issue: 'below_minimum' });
    expect(normalizeIdleTimeoutMinutes(MAX_IDLE_TIMEOUT_MINUTES + 1)).toMatchObject({
      minutes: MAX_IDLE_TIMEOUT_MINUTES,
      issue: 'above_maximum',
    });
    expect(normalizeIdleTimeoutMinutes(7.6)).toMatchObject({ minutes: 8, issue: 'not_an_integer' });
  });

  it('falls back to the default (never "off") for invalid input', () => {
    for (const bad of [Number.NaN, Infinity, 'abc', '', '   ', null, undefined, {}, []]) {
      expect(normalizeIdleTimeoutMinutes(bad)).toMatchObject({
        minutes: DEFAULT_IDLE_TIMEOUT_MINUTES,
        valid: false,
        issue: 'not_a_number',
      });
    }
    expect(normalizeIdleTimeoutMinutes(-5)).toMatchObject({ minutes: DEFAULT_IDLE_TIMEOUT_MINUTES, issue: 'negative' });
  });
});

describe('idle timeout persistence', () => {
  it('round-trips a saved value', () => {
    const storage = memoryStorage();
    expect(saveIdleTimeoutMinutes(30, storage)).toBe(30);
    expect(storage.data.get(IDLE_TIMEOUT_STORAGE_KEY)).toBe('30');
    expect(loadIdleTimeoutMinutes(storage)).toBe(30);
  });

  it('uses the default when nothing is stored or storage is unavailable', () => {
    expect(loadIdleTimeoutMinutes(memoryStorage())).toBe(DEFAULT_IDLE_TIMEOUT_MINUTES);
    expect(loadIdleTimeoutMinutes(null)).toBe(DEFAULT_IDLE_TIMEOUT_MINUTES);
  });

  it('recovers from corrupt stored values and throwing storage', () => {
    expect(loadIdleTimeoutMinutes(memoryStorage({ [IDLE_TIMEOUT_STORAGE_KEY]: 'garbage' }))).toBe(
      DEFAULT_IDLE_TIMEOUT_MINUTES,
    );
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadIdleTimeoutMinutes(throwing)).toBe(DEFAULT_IDLE_TIMEOUT_MINUTES);
    expect(saveIdleTimeoutMinutes(5, throwing)).toBe(5);
  });
});

describe('environment support', () => {
  it('reports a browser-like environment as supported', () => {
    expect(isIdleTimeoutSupported(window as never)).toBe(true);
  });

  it('reports environments without DOM events or timers as unsupported', () => {
    expect(isIdleTimeoutSupported(null)).toBe(false);
    expect(isIdleTimeoutSupported({ setTimeout, clearTimeout })).toBe(false);
    expect(isIdleTimeoutSupported({ addEventListener: () => {}, removeEventListener: () => {} })).toBe(false);
  });
});

describe('getWarningLeadMs', () => {
  it('uses 60s for normal timeouts and caps at half the timeout for short ones', () => {
    expect(getWarningLeadMs(15 * MINUTE)).toBe(60_000);
    expect(getWarningLeadMs(1 * MINUTE)).toBe(30_000);
  });
});

describe('createIdleSessionMonitor', () => {
  let target: EventTarget;
  let visibility: EventTarget;

  beforeEach(() => {
    vi.useFakeTimers();
    target = new EventTarget();
    visibility = new EventTarget();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function build(overrides: Partial<Parameters<typeof createIdleSessionMonitor>[0]> = {}) {
    const onWarning = vi.fn();
    const onTimeout = vi.fn();
    const monitor = createIdleSessionMonitor({
      timeoutMs: 5 * MINUTE,
      onWarning,
      onTimeout,
      target,
      visibilityTarget: visibility,
      ...overrides,
    });
    return { monitor, onWarning, onTimeout };
  }

  it('warns one minute before expiry, then times out (primary flow)', () => {
    const { monitor, onWarning, onTimeout } = build();
    monitor.start();
    expect(monitor.getPhase()).toBe('active');

    vi.advanceTimersByTime(4 * MINUTE - 1);
    expect(onWarning).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onWarning).toHaveBeenCalledWith(60_000);
    expect(monitor.getPhase()).toBe('warning');
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(monitor.getPhase()).toBe('expired');
    expect(monitor.getRemainingMs()).toBe(0);
  });

  it('activity before the warning pushes the deadline back', () => {
    const { monitor, onWarning } = build();
    monitor.start();

    vi.advanceTimersByTime(3 * MINUTE);
    target.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(3 * MINUTE);
    expect(onWarning).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1 * MINUTE);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('passive activity does not dismiss an open warning; acknowledge does', () => {
    const { monitor, onTimeout } = build();
    monitor.start();
    vi.advanceTimersByTime(4 * MINUTE);
    expect(monitor.getPhase()).toBe('warning');

    target.dispatchEvent(new Event('pointermove'));
    expect(monitor.getPhase()).toBe('warning');

    monitor.acknowledge();
    expect(monitor.getPhase()).toBe('active');
    expect(monitor.getRemainingMs()).toBe(5 * MINUTE);

    vi.advanceTimersByTime(4 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('expires immediately on wake when the machine slept past the deadline (boundary)', () => {
    const { monitor, onTimeout } = build();
    monitor.start();

    // Simulate a suspended tab: wall clock jumps, but no timers fired.
    vi.setSystemTime(Date.now() + 10 * MINUTE);
    visibility.dispatchEvent(new Event('visibilitychange'));

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(monitor.getPhase()).toBe('expired');
  });

  it('stop() cancels pending timers and detaches listeners', () => {
    const { monitor, onWarning, onTimeout } = build();
    const removeSpy = vi.spyOn(target, 'removeEventListener');
    monitor.start();
    monitor.stop();

    vi.advanceTimersByTime(10 * MINUTE);
    expect(onWarning).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
    expect(monitor.getPhase()).toBe('stopped');
    expect(removeSpy).toHaveBeenCalled();
  });

  it('is a no-op when there is no event target (unsupported environment)', () => {
    const { monitor, onTimeout } = build({ target: null });
    expect(monitor.supported).toBe(false);
    monitor.start();
    vi.advanceTimersByTime(10 * MINUTE);
    expect(monitor.getPhase()).toBe('stopped');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('rejects non-positive or non-finite timeouts (failure path)', () => {
    expect(() => build({ timeoutMs: 0 })).toThrow(RangeError);
    expect(() => build({ timeoutMs: -1 })).toThrow(RangeError);
    expect(() => build({ timeoutMs: Number.NaN })).toThrow(RangeError);
  });
});
