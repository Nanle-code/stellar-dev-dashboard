import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CopyableValue from '../CopyableValue';

const writeText = vi.fn();
const SECRET = 'S' + 'A'.repeat(55);

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

describe('CopyableValue — primary flow', () => {
  it('copies a normal value in a single click', async () => {
    const onCopy = vi.fn();
    render(<CopyableValue value="GABCDEF1234567890" onCopy={onCopy} />);

    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('GABCDEF1234567890'));
    expect(onCopy).toHaveBeenCalledWith('GABCDEF1234567890');
  });
});

describe('CopyableValue — sensitive gating', () => {
  it('requires confirmation before copying a detected secret', async () => {
    render(<CopyableValue value={SECRET} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(writeText).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('data-confirming');

    fireEvent.click(screen.getByRole('button', { name: /confirm sensitive copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET));
  });

  it('gates plain values when explicitly flagged sensitive', () => {
    render(<CopyableValue value="opaque-token" sensitive sensitiveLabel="Token" />);
    fireEvent.click(screen.getByRole('button'));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveAttribute('data-sensitive');
  });

  it('stays idle for an empty value', () => {
    render(<CopyableValue value="" />);
    fireEvent.click(screen.getByRole('button'));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).not.toHaveAttribute('data-confirming');
  });
});

describe('CopyableValue — failure path', () => {
  it('recovers when the clipboard write rejects', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<CopyableValue value="GABCDEF1234567890" />);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    // Still offer copying again rather than showing a false "Copied" state.
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy to clipboard');
  });
});
