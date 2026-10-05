import React, { useRef, useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useOverlayKeyboardGuard } from '../../../src/hooks/useOverlayKeyboardGuard';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function Overlay({
  id,
  label,
  open,
  onClose,
}: {
  id: string;
  label: string;
  open: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const guard = useOverlayKeyboardGuard({ enabled: open, onClose, containerRef });
  if (!open) return null;
  return (
    <div ref={containerRef} role="dialog" aria-label={label} data-testid={id} {...guard}>
      <button onClick={onClose} data-testid={`${id}-close`}>
        Close {label}
      </button>
      <button data-testid={`${id}-last`}>Last</button>
    </div>
  );
}

function StackHarness({ outerOpen, innerOpen, onCloseOuter, onCloseInner }: {
  outerOpen: boolean;
  innerOpen: boolean;
  onCloseOuter: () => void;
  onCloseInner: () => void;
}) {
  return (
    <>
      <button data-testid="background">Background</button>
      <Overlay id="outer" label="outer" open={outerOpen} onClose={onCloseOuter} />
      <Overlay id="inner" label="inner" open={innerOpen} onClose={onCloseInner} />
    </>
  );
}

describe('useOverlayKeyboardGuard', () => {
  it('closes the topmost overlay on Escape (primary flow)', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(<StackHarness outerOpen innerOpen={false} onCloseOuter={closeOuter} onCloseInner={closeInner} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeOuter).toHaveBeenCalledTimes(1);
    expect(closeInner).not.toHaveBeenCalled();
  });

  it('resolves Escape LIFO when overlays are nested (boundary)', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const { rerender } = render(
      <StackHarness outerOpen innerOpen={false} onCloseOuter={closeOuter} onCloseInner={closeInner} />,
    );

    // Open the inner overlay on top of the outer one.
    rerender(
      <StackHarness outerOpen innerOpen onCloseOuter={closeOuter} onCloseInner={closeInner} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();

    // After the inner overlay closes, Escape reaches the outer overlay.
    rerender(
      <StackHarness outerOpen innerOpen={false} onCloseOuter={closeOuter} onCloseInner={closeInner} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeOuter).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab within the overlay instead of leaking to background (primary flow)', () => {
    render(<StackHarness outerOpen innerOpen={false} onCloseOuter={() => {}} onCloseInner={() => {}} />);

    const first = screen.getByTestId('outer-close');
    const last = screen.getByTestId('outer-last');
    last.focus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('ignores Escape and Tab while disabled (failure path)', () => {
    const onClose = vi.fn();
    render(<StackHarness outerOpen={false} innerOpen={false} onCloseOuter={onClose} onCloseInner={() => {}} />);

    const background = screen.getByTestId('background');
    background.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(background);
  });

  it('never lets an outer overlay consume Escape while an inner one is open', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    // Mocked onClose does not unmount anything: the inner overlay stays
    // topmost for both presses, and the outer must never fire.
    render(<StackHarness outerOpen innerOpen onCloseOuter={closeOuter} onCloseInner={closeInner} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(closeInner).toHaveBeenCalledTimes(2);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
