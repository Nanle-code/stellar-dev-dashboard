/**
 * Tests for useWriteGuard — #983 Mainnet Safety Guard
 *
 * Covers:
 *  - Primary flow: non-mainnet calls onConfirm immediately
 *  - Primary flow: mainnet shows dialog, onConfirm fires after guard confirms
 *  - Boundary: read-only lock blocks the action without opening the dialog
 *  - Failure: dialog cancel does not call onConfirm
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock Zustand store ────────────────────────────────────────────────────────
vi.mock('../../../src/lib/store', () => ({
  useStore: vi.fn(),
}));

import { useStore } from '../../../src/lib/store';
import { useWriteGuard } from '../../../src/hooks/useWriteGuard';

// ── Mock sessionStorage ───────────────────────────────────────────────────────
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock });

// ─────────────────────────────────────────────────────────────────────────────

describe('useWriteGuard', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Primary flow: non-mainnet ───────────────────────────────────────────────

  it('calls onConfirm immediately when not on mainnet', () => {
    (useStore as any).mockReturnValue({ network: 'testnet' });

    const { result } = renderHook(() => useWriteGuard());
    const onConfirm = vi.fn();

    act(() => {
      result.current.guard({ action: 'payment', onConfirm });
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(result.current.dialogOpen).toBe(false);
  });

  it('calls onConfirm immediately on futurenet', () => {
    (useStore as any).mockReturnValue({ network: 'futurenet' });

    const { result } = renderHook(() => useWriteGuard());
    const onConfirm = vi.fn();

    act(() => {
      result.current.guard({ action: 'deploy', onConfirm });
    });

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  // ── Primary flow: mainnet opens dialog then confirms ────────────────────────

  it('opens dialog on mainnet instead of calling onConfirm directly', () => {
    (useStore as any).mockReturnValue({ network: 'mainnet' });

    const { result } = renderHook(() => useWriteGuard());
    const onConfirm = vi.fn();

    act(() => {
      result.current.guard({ action: 'payment', onConfirm });
    });

    expect(result.current.dialogOpen).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm when dialog confirm handler is invoked', () => {
    (useStore as any).mockReturnValue({ network: 'mainnet' });

    const { result } = renderHook(() => useWriteGuard());
    const onConfirm = vi.fn();

    act(() => {
      result.current.guard({ action: 'payment', onConfirm });
    });

    act(() => {
      result.current.dialogProps.onConfirm();
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(result.current.dialogOpen).toBe(false);
  });

  it('exposes the action label in dialogProps', () => {
    (useStore as any).mockReturnValue({ network: 'mainnet' });

    const { result } = renderHook(() => useWriteGuard());

    act(() => {
      result.current.guard({ action: 'sign transaction', onConfirm: vi.fn() });
    });

    expect(result.current.dialogProps.actionLabel).toBe('sign transaction');
  });

  // ── Failure: dialog cancel ──────────────────────────────────────────────────

  it('does not call onConfirm when dialog is cancelled', () => {
    (useStore as any).mockReturnValue({ network: 'mainnet' });

    const { result } = renderHook(() => useWriteGuard());
    const onConfirm = vi.fn();

    act(() => {
      result.current.guard({ action: 'payment', onConfirm });
    });

    act(() => {
      result.current.dialogProps.onCancel();
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.dialogOpen).toBe(false);
  });

  // ── Boundary: read-only lock ────────────────────────────────────────────────

  it('blocks writes and does not open dialog when read-only lock is active on mainnet', () => {
    (useStore as any).mockReturnValue({ network: 'mainnet' });

    const { result } = renderHook(() => useWriteGuard());
    const onConfirm = vi.fn();

    // Activate lock
    act(() => { result.current.lockReadOnly(); });
    expect(result.current.isReadOnlyLocked).toBe(true);

    act(() => {
      result.current.guard({ action: 'payment', onConfirm });
    });

    expect(result.current.dialogOpen).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('read-only lock has no effect on non-mainnet', () => {
    (useStore as any).mockReturnValue({ network: 'testnet' });

    const { result } = renderHook(() => useWriteGuard());
    const onConfirm = vi.fn();

    act(() => { result.current.lockReadOnly(); });

    // isReadOnlyLocked should be false because not on mainnet
    expect(result.current.isReadOnlyLocked).toBe(false);

    act(() => {
      result.current.guard({ action: 'payment', onConfirm });
    });

    // Still fires on testnet
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('persists read-only lock in sessionStorage', () => {
    (useStore as any).mockReturnValue({ network: 'mainnet' });

    const { result } = renderHook(() => useWriteGuard());

    act(() => { result.current.lockReadOnly(); });
    expect(sessionStorageMock.getItem('stellar:mainnet-readonly-lock')).toBe('true');

    act(() => { result.current.unlockReadOnly(); });
    expect(sessionStorageMock.getItem('stellar:mainnet-readonly-lock')).toBeNull();
  });
});
