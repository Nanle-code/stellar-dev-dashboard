/**
 * Tests for MainnetConfirmDialog — #983 Mainnet Safety Guard
 *
 * Covers:
 *  - Primary flow: confirm button enabled only after typing "mainnet"
 *  - Primary flow: Enter key submits when phrase is correct
 *  - Boundary: case-insensitive match ("MAINNET", "Mainnet")
 *  - Failure: partial phrase keeps confirm disabled
 *  - Failure: Escape key calls onCancel
 *  - Accessibility: dialog role and aria-modal present
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MainnetConfirmDialog from '../../../src/components/security/MainnetConfirmDialog';

const defaultProps = {
  open: true,
  actionLabel: 'payment',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function setup(props = {}) {
  const merged = { ...defaultProps, onConfirm: vi.fn(), onCancel: vi.fn(), ...props };
  render(<MainnetConfirmDialog {...merged} />);
  return merged;
}

describe('MainnetConfirmDialog', () => {
  // ── Primary flow ──────────────────────────────────────────────────────────

  it('renders the action label', () => {
    setup({ actionLabel: 'sign transaction' });
    expect(screen.getByText(/sign transaction/i)).toBeTruthy();
  });

  it('confirm button is disabled when input is empty', () => {
    setup();
    const btn = screen.getByRole('button', { name: /confirm write/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button becomes enabled after typing "mainnet"', async () => {
    setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'mainnet');
    const btn = screen.getByRole('button', { name: /confirm write/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls onConfirm when confirm button is clicked with correct phrase', async () => {
    const props = setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'mainnet');
    await userEvent.click(screen.getByRole('button', { name: /confirm write/i }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when Enter is pressed with correct phrase', async () => {
    const props = setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'mainnet{Enter}');
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  // ── Boundary cases ────────────────────────────────────────────────────────

  it('accepts "MAINNET" (case-insensitive)', async () => {
    const props = setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'MAINNET');
    const btn = screen.getByRole('button', { name: /confirm write/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('accepts "Mainnet" (mixed case)', async () => {
    const props = setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Mainnet');
    const btn = screen.getByRole('button', { name: /confirm write/i });
    expect(btn).not.toBeDisabled();
  });

  it('accepts " mainnet " (leading/trailing whitespace)', async () => {
    const props = setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, ' mainnet ');
    const btn = screen.getByRole('button', { name: /confirm write/i });
    expect(btn).not.toBeDisabled();
  });

  // ── Failure cases ─────────────────────────────────────────────────────────

  it('confirm button stays disabled with partial phrase "main"', async () => {
    setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'main');
    const btn = screen.getByRole('button', { name: /confirm write/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button stays disabled with wrong phrase "testnet"', async () => {
    setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'testnet');
    const btn = screen.getByRole('button', { name: /confirm write/i });
    expect(btn).toBeDisabled();
  });

  it('does not call onConfirm when Enter is pressed with wrong phrase', async () => {
    const props = setup();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'testnet{Enter}');
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Escape key is pressed', () => {
    const props = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when backdrop is clicked', async () => {
    const props = setup();
    // The backdrop is the outermost div with role="presentation"
    const backdrop = document.querySelector('[role="presentation"]') as HTMLElement;
    await userEvent.click(backdrop);
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it('renders a dialog with aria-modal', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('does not render when open is false', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
