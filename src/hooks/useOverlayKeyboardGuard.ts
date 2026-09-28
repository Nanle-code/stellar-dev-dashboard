import { useCallback, useEffect, useRef } from 'react';

/**
 * Stack-aware keyboard guard for nested modal / drawer overlays (#874).
 *
 * Complements `auditOverlayStacks` in `src/lib/keyboardNavigationAudit.ts`:
 * the audit *detects* traps, this hook *prevents* the two classic ones when
 * overlays are nested:
 *
 * - **Escape blocked**: Escape always closes the *topmost* overlay first
 *   (LIFO), never an inner one while an outer is still open, and never a
 *   background handler underneath the stack.
 * - **Tab leaking / stranding**: Tab wraps within the overlay's focusables,
 *   so focus cannot escape to inert background content or fall off the edge
 *   of a container whose last control is the one focused.
 *
 * Usage (per overlay, including nested ones):
 *
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const guard = useOverlayKeyboardGuard({ onClose: () => setOpen(false), containerRef });
 * <div role="dialog" aria-modal="true" ref={containerRef} {...guard}>…</div>
 * ```
 *
 * Unsupported environments (SSR, no `document`) are inert: the hook returns
 * stable props and never throws.
 */

export interface OverlayKeyboardGuardOptions {
  /** Whether the overlay is currently open/active. */
  enabled?: boolean;
  /** Called when Escape dismisses this overlay (only when it is topmost). */
  onClose?: () => void;
  /** Ref to the overlay container used to scope Tab wrap-around. */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Disable Tab wrap-around if the overlay manages focus differently. */
  wrapFocus?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * LIFO registry of currently open overlays. The last entry is the topmost
 * overlay and is the only one allowed to consume Escape.
 */
const overlayStack: symbol[] = [];

export function useOverlayKeyboardGuard({
  enabled = true,
  onClose,
  containerRef,
  wrapFocus = true,
}: OverlayKeyboardGuardOptions = {}): { 'data-overlay-guard': 'active' | 'inactive' } {
  const idRef = useRef<Symbol | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const id = Symbol('overlay-guard');
    idRef.current = id;
    overlayStack.push(id);

    const isTopmost = () => overlayStack[overlayStack.length - 1] === id;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key === 'Tab' && wrapFocus && containerRef?.current) {
        const container = containerRef.current;
        const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey && (active === first || !container.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !container.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // Capture phase so the guard wins over per-control listeners.
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const index = overlayStack.indexOf(id);
      if (index >= 0) overlayStack.splice(index, 1);
      idRef.current = null;
    };
  }, [enabled, wrapFocus, containerRef]);

  return { 'data-overlay-guard': enabled ? 'active' : 'inactive' };
}

/**
 * Escape handling scoped to a single overlay: only fires when this overlay is
 * the topmost of the registered stack. Useful for components that already
 * have their own keydown wiring and only need LIFO gating.
 */
export function useIsTopmostOverlay(enabled = true): () => boolean {
  const idRef = useRef<Symbol | null>(null);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const id = Symbol('overlay-guard');
    idRef.current = id;
    overlayStack.push(id);
    return () => {
      const index = overlayStack.indexOf(id);
      if (index >= 0) overlayStack.splice(index, 1);
      idRef.current = null;
    };
  }, [enabled]);

  return useCallback(
    () => idRef.current !== null && overlayStack[overlayStack.length - 1] === idRef.current,
    [],
  );
}
