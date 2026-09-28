import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  guardProviderSend,
  getProviderPolicy,
  getProviderStats,
  setProviderPolicy,
  clearProviderPolicy,
  resetProviderCircuitBreaker,
  isTransportSupported,
} from '../providerCircuitBreaker';

const TOUCHED_PROVIDERS = [
  'test-primary',
  'test-boundary',
  'test-fail-open',
  'test-fail-closed',
  'test-invalid',
  'test-no-transport',
  'test-policy',
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  TOUCHED_PROVIDERS.forEach((provider) => resetProviderCircuitBreaker(provider));
  TOUCHED_PROVIDERS.forEach((provider) => clearProviderPolicy(provider));
});

describe('providerCircuitBreaker', () => {
  it('delivers successfully and keeps the circuit CLOSED (primary flow)', async () => {
    const operation = vi.fn().mockResolvedValue('ok');

    const result = await guardProviderSend('test-primary', operation);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ delivered: true, dropped: false, skipped: false, value: 'ok' });
    expect(getProviderStats('test-primary').state).toBe('CLOSED');
  });

  it('opens the circuit after the failure threshold, skips requests while OPEN, then recovers via HALF_OPEN (boundary)', async () => {
    vi.useFakeTimers();
    const options = { failureThreshold: 2, successThreshold: 1, timeout: 1000 };
    const operation = vi.fn().mockRejectedValue(new Error('provider down'));

    const first = await guardProviderSend('test-boundary', operation, options);
    expect(first).toMatchObject({ delivered: false, dropped: true, skipped: false });

    const second = await guardProviderSend('test-boundary', operation, options);
    expect(second.dropped).toBe(true);
    expect(getProviderStats('test-boundary').state).toBe('OPEN');

    // While OPEN the operation must not be invoked at all.
    operation.mockClear();
    const skipped = await guardProviderSend('test-boundary', operation, options);
    expect(skipped).toMatchObject({ delivered: false, dropped: true, skipped: true });
    expect(operation).not.toHaveBeenCalled();

    // After the cooldown the breaker probes once and closes on success.
    vi.advanceTimersByTime(1001);
    operation.mockResolvedValue(undefined);
    const recovered = await guardProviderSend('test-boundary', operation, options);

    expect(recovered.delivered).toBe(true);
    expect(getProviderStats('test-boundary').state).toBe('CLOSED');
  });

  it('fails open by swallowing provider errors (failure path)', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    const result = await guardProviderSend('test-fail-open', operation, { policy: 'fail-open' });

    expect(result.delivered).toBe(false);
    expect(result.dropped).toBe(true);
    expect((result.error as Error).message).toBe('boom');
  });

  it('fails closed by re-throwing provider errors (failure path)', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      guardProviderSend('test-fail-closed', operation, { policy: 'fail-closed' }),
    ).rejects.toThrow('boom');
  });

  it('rejects invalid input with a TypeError', async () => {
    await expect(guardProviderSend('', vi.fn())).rejects.toThrow(TypeError);
    await expect(guardProviderSend('test-invalid', null as never)).rejects.toThrow(TypeError);
    expect(() => setProviderPolicy('test-invalid', 'sometimes' as never)).toThrow(TypeError);
  });

  it('fails open when no network transport is available (unsupported environment)', async () => {
    vi.stubGlobal('fetch', undefined);
    vi.stubGlobal('navigator', { sendBeacon: undefined });

    expect(isTransportSupported()).toBe(false);

    const operation = vi.fn();
    const result = await guardProviderSend('test-no-transport', operation, { policy: 'fail-open' });

    expect(result).toMatchObject({ delivered: false, dropped: true, skipped: true });
    expect(operation).not.toHaveBeenCalled();
    expect(getProviderStats('test-no-transport').state).toBe('CLOSED');
  });

  it('fails closed when no network transport is available (unsupported environment)', async () => {
    vi.stubGlobal('fetch', undefined);
    vi.stubGlobal('navigator', { sendBeacon: undefined });

    await expect(
      guardProviderSend('test-no-transport', vi.fn(), { policy: 'fail-closed' }),
    ).rejects.toThrow(/No network transport/);
  });

  it('resolves per-provider policies from defaults and overrides', () => {
    expect(getProviderPolicy('analytics')).toBe('fail-open');
    expect(getProviderPolicy('errorReporting')).toBe('fail-closed');

    setProviderPolicy('test-policy', 'fail-closed');
    expect(getProviderPolicy('test-policy')).toBe('fail-closed');

    clearProviderPolicy('test-policy');
    expect(getProviderPolicy('test-policy')).toBe('fail-open');
  });
});
