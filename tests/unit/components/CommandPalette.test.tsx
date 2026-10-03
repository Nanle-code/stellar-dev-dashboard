import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { StrKey } from '@stellar/stellar-sdk';

const mockStore = {
  setConnectedAddress: vi.fn(),
  setSelectedTemplateId: vi.fn(),
  setPreferencesOpen: vi.fn(),
  setActiveTab: vi.fn(),
};

vi.mock('../../../src/lib/store', () => ({
  useStore: () => mockStore,
}));

const accessibilityMocks = vi.hoisted(() => ({
  getRecentAccounts: vi.fn(() => []),
  addRecentAccount: vi.fn(),
  getTransactionTemplates: vi.fn(() => ({})),
}));

vi.mock('../../../src/utils/accessibility', () => ({
  registerShortcut: vi.fn(() => () => {}),
  ...accessibilityMocks,
}));

import { CommandPalette } from '../../../src/components/accessibility/KeyboardNavigation';

const ACCOUNT = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 1));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPalette(props: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  const onClose = vi.fn();
  const onShowShortcuts = vi.fn();
  render(
    <MemoryRouter initialEntries={['/overview']}>
      <CommandPalette isOpen onClose={onClose} onShowShortcuts={onShowShortcuts} {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
  const input = screen.getByRole('combobox');
  return { input, onClose, onShowShortcuts };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessibilityMocks.getRecentAccounts.mockImplementation(() => []);
    accessibilityMocks.addRecentAccount.mockImplementation(() => {});
  });

  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('primary flow: pasting an account address jumps to that account', () => {
    const { input, onClose } = renderPalette();
    fireEvent.change(input, { target: { value: ACCOUNT } });

    expect(screen.getByRole('option', { name: /open account/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockStore.setConnectedAddress).toHaveBeenCalledWith(ACCOUNT);
    expect(accessibilityMocks.addRecentAccount).toHaveBeenCalledWith(ACCOUNT);
    expect(screen.getByTestId('location')).toHaveTextContent(`/account/${ACCOUNT}`);
    expect(onClose).toHaveBeenCalled();
  });

  it('primary flow: pasting a contract ID jumps to the contract view', () => {
    const { input } = renderPalette();
    fireEvent.change(input, { target: { value: CONTRACT } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent(`/contracts/${CONTRACT}`);
  });

  it('primary flow: searching for settings and opening preferences', () => {
    const { input, onClose } = renderPalette();
    fireEvent.change(input, { target: { value: 'preferences' } });
    fireEvent.click(screen.getByRole('option', { name: 'Open User Preferences' }));
    expect(mockStore.setPreferencesOpen).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/overview');
  });

  it('arrow keys move the selection and Enter runs it', () => {
    const { input } = renderPalette();
    fireEvent.change(input, { target: { value: 'settings' } });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);
  });

  it('boundary: arrow keys on an empty result list do not break selection', () => {
    const { input, onClose } = renderPalette();
    fireEvent.change(input, { target: { value: 'zzzz-no-such-command' } });
    expect(screen.getByRole('status')).toHaveTextContent(/no matching commands/i);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    // Clearing the query restores the list with the first item selected.
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('failure: a malformed address shows a validation alert and cannot be submitted', () => {
    const { input, onClose } = renderPalette();
    fireEvent.change(input, { target: { value: ACCOUNT.slice(0, 50) } });

    expect(screen.getByRole('alert')).toHaveTextContent(/56 characters/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryAllByRole('option')).toHaveLength(0);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    expect(mockStore.setConnectedAddress).not.toHaveBeenCalled();
  });

  it('failure: a throwing action keeps the palette open with an error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockStore.setPreferencesOpen.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { input, onClose } = renderPalette();
    fireEvent.change(input, { target: { value: 'user preferences' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't run "open user preferences"/i);
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('unsupported environment: blocked localStorage does not stop the palette or navigation', () => {
    accessibilityMocks.getRecentAccounts.mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    accessibilityMocks.addRecentAccount.mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const { input, onClose } = renderPalette();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);

    fireEvent.change(input, { target: { value: ACCOUNT } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent(`/account/${ACCOUNT}`);
    expect(onClose).toHaveBeenCalled();
  });

  it('the shortcuts command hands off to the shortcuts help', () => {
    const { input, onShowShortcuts } = renderPalette();
    fireEvent.change(input, { target: { value: 'keyboard shortcuts' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onShowShortcuts).toHaveBeenCalled();
  });
});
