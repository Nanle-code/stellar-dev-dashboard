/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeFreighterNetwork,
  onFreighterAccountChange,
  onFreighterLock,
  subscribeFreighterSession,
  connectFreighter,
  signTransactionWithFreighter,
  __resetFreighterApiCacheForTests,
} from '../../../../src/lib/wallet/freighter.js';

const VALID_KEY = 'GBTRHGO73LJZ6BST3MIFJNKZZVVNCNYCM4U5N4M47OOJYEG3QEOY4NS3';

describe('freighter connector', () => {
  beforeEach(() => {
    window.freighterApi = {
      isConnected: vi.fn(async () => ({ isConnected: true })),
      isAllowed: vi.fn(async () => ({ isAllowed: true })),
      requestAccess: vi.fn(async () => ({ address: VALID_KEY })),
      getAddress: vi.fn(async () => ({ address: VALID_KEY })),
      getNetwork: vi.fn(async () => ({ network: 'TESTNET' })),
      signTransaction: vi.fn(async (xdr) => ({ signedTxXdr: xdr + '_signed' })),
    };
  });

  afterEach(() => {
    delete window.freighterApi;
    __resetFreighterApiCacheForTests();
    vi.restoreAllMocks();
  });

  it('primary flow: connects successfully with valid key and network', async () => {
    const res = await connectFreighter();
    expect(res.publicKey).toBe(VALID_KEY);
    expect(res.network).toBe('TESTNET');
  });

  it('threat model: rejects spoofed or corrupted public key from extension', async () => {
    window.freighterApi.getAddress = vi.fn(async () => ({ address: 'MALICIOUS_SPOOFED_KEY_123' }));

    await expect(connectFreighter()).rejects.toThrowError(
      /Freighter returned an invalid or spoofed public key/i
    );
  });

  it('threat model: rejects empty or invalid XDR payload', async () => {
    await expect(signTransactionWithFreighter('')).rejects.toThrowError(
      'Transaction XDR is required.'
    );
    await expect(signTransactionWithFreighter(null)).rejects.toThrowError(
      'Transaction XDR is required.'
    );
    await expect(signTransactionWithFreighter(12345)).rejects.toThrowError(
      'Transaction XDR is required.'
    );
  });

  it('primary flow: signs valid transaction XDR', async () => {
    const signed = await signTransactionWithFreighter('AAAA_MOCK_TX_XDR', 'TESTNET');
    expect(signed).toBe('AAAA_MOCK_TX_XDR_signed');
  });

  it('failure case: user declined connection request', async () => {
    window.freighterApi.requestAccess = vi.fn(async () => ({ error: 'User declined access.' }));
    await expect(connectFreighter()).rejects.toThrowError('User declined access.');
  });

  it('failure case: user declined transaction signing', async () => {
    window.freighterApi.signTransaction = vi.fn(async () => ({
      error: 'User declined transaction signing.',
    }));
    await expect(signTransactionWithFreighter('AAAA_TX')).rejects.toThrowError(
      'User declined transaction signing.'
    );
  });

  it('failure case: extension is locked', async () => {
    window.freighterApi.requestAccess = vi.fn(async () => ({
      error: 'Freighter is locked. Please unlock it.',
    }));
    await expect(connectFreighter()).rejects.toThrowError('Freighter is locked. Please unlock it.');
  });

  it('unsupported environment: throws clear installation link when extension is missing', async () => {
    delete window.freighterApi;
    __resetFreighterApiCacheForTests();

    await expect(connectFreighter()).rejects.toThrowError(
      /not installed.*https:\/\/freighter\.app/i
    );
    await expect(signTransactionWithFreighter('AAAA')).rejects.toThrowError(
      'Freighter wallet is not available'
    );
  });

  it('normalizes supported Freighter networks', () => {
    expect(normalizeFreighterNetwork('PUBLIC')).toBe('mainnet');
    expect(normalizeFreighterNetwork('TESTNET')).toBe('testnet');
    expect(normalizeFreighterNetwork('FUTURENET')).toBe('futurenet');
  });

  it('boundary case: returns null for invalid network input', () => {
    expect(normalizeFreighterNetwork('')).toBeNull();
    expect(normalizeFreighterNetwork('UNKNOWN')).toBeNull();
    expect(normalizeFreighterNetwork(null)).toBeNull();
  });

  it('boundary case: handles account change events', () => {
    const callback = vi.fn();
    const cleanup = onFreighterAccountChange(callback);

    window.dispatchEvent(new CustomEvent('freighterAccountChange', { detail: 'GNEW123' }));
    expect(callback).toHaveBeenCalledWith('GNEW123');

    cleanup();
    window.dispatchEvent(new CustomEvent('freighterAccountChange', { detail: 'GOTHER' }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('handles lock events', () => {
    const callback = vi.fn();
    const cleanup = onFreighterLock(callback);

    window.dispatchEvent(new CustomEvent('freighterLock'));
    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('polls for account changes when Freighter updates outside DOM events', async () => {
    const onAccountChange = vi.fn();
    const cleanup = subscribeFreighterSession({
      onAccountChange,
      pollIntervalMs: 20,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onAccountChange).not.toHaveBeenCalled();

    window.freighterApi.getAddress = vi.fn(async () => ({ address: 'GNEW456' }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(onAccountChange).toHaveBeenCalledWith('GNEW456');
    cleanup();
  });

  it('reports disconnect when Freighter is no longer available', async () => {
    const onDisconnect = vi.fn();
    const cleanup = subscribeFreighterSession({
      onDisconnect,
      pollIntervalMs: 20,
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    delete window.freighterApi;
    __resetFreighterApiCacheForTests();

    await vi.waitFor(
      () => {
        expect(onDisconnect).toHaveBeenCalled();
      },
      { timeout: 200 }
    );

    cleanup();
  });
});
