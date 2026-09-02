import { describe, it, expect } from 'vitest';
import {
  WALLET_DIAGNOSTIC_CATEGORIES,
  diagnoseFreighterError,
  diagnoseLedgerError,
  diagnoseWalletConnection,
} from '../diagnostics';

describe('wallet connection diagnostics', () => {
  // ─── Primary flow ────────────────────────────────────────────────────────────
  describe('diagnoseWalletConnection primary flow', () => {
    it('classifies a Freighter "not installed" error and returns a remediation', () => {
      const d = diagnoseWalletConnection(
        'freighter',
        new Error('Freighter wallet extension is not installed. Please install it from https://freighter.app')
      );
      expect(d.matched).toBe(true);
      expect(d.category).toBe(WALLET_DIAGNOSTIC_CATEGORIES.EXTENSION_NOT_INSTALLED);
      expect(d.severity).toBe('error');
      expect(d.remediation).toContain('https://freighter.app');
    });

    it('routes unknown wallet types to a generic diagnostic (unsupported environment)', () => {
      const d = diagnoseWalletConnection('trezor', new Error('boom'));
      expect(d.matched).toBe(false);
      expect(d.category).toBe(WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN);
      expect(d.message).toContain('unsupported wallet type');
    });
  });

  // ─── Freighter failure cases ────────────────────────────────────────────────
  describe('diagnoseFreighterError', () => {
    it.each([
      ['not installed', 'Freighter is not installed. Get it at https://freighter.app', WALLET_DIAGNOSTIC_CATEGORIES.EXTENSION_NOT_INSTALLED],
      ['not found', 'Freighter wallet not found', WALLET_DIAGNOSTIC_CATEGORIES.EXTENSION_NOT_INSTALLED],
      ['locked', 'Freighter is locked. Unlock it to continue.', WALLET_DIAGNOSTIC_CATEGORIES.EXTENSION_LOCKED],
      ['denied', 'User declined access.', WALLET_DIAGNOSTIC_CATEGORIES.ACCESS_DENIED],
      ['network', 'You must first turn off account network.', WALLET_DIAGNOSTIC_CATEGORIES.NETWORK_MISMATCH],
    ])('maps "%s" to the right category', (_label, message, category) => {
      const d = diagnoseFreighterError(new Error(message));
      expect(d.category).toBe(category);
      expect(d.matched).toBe(true);
    });
  });

  // ─── Ledger failure cases ───────────────────────────────────────────────────
  describe('diagnoseLedgerError', () => {
    it.each([
      ['browser unsupported', 'WebUSB/WebHID is not supported in this browser. Please use Chrome or a Chromium-based browser.', WALLET_DIAGNOSTIC_CATEGORIES.BROWSER_UNSUPPORTED],
      ['locked device', 'Ledger device is locked. Unlock it and open the Stellar app.', WALLET_DIAGNOSTIC_CATEGORIES.HARDWARE_LOCKED],
      ['app not open', 'Stellar app is not open on the Ledger device.', WALLET_DIAGNOSTIC_CATEGORIES.STELLAR_APP_NOT_OPEN],
      ['rejected', 'Transaction was rejected on the Ledger device.', WALLET_DIAGNOSTIC_CATEGORIES.ACCESS_DENIED],
      ['dependency missing', 'Optional dependency "@ledgerhq/hw-transport-webusb" is not installed.', WALLET_DIAGNOSTIC_CATEGORIES.LEDGER_DEPENDENCY_MISSING],
      ['device not found', 'No device selected. (0x6a80)', WALLET_DIAGNOSTIC_CATEGORIES.HARDWARE_NOT_CONNECTED],
    ])('maps "%s" to the right category', (_label, message, category) => {
      const d = diagnoseLedgerError(new Error(message));
      expect(d.category).toBe(category);
      expect(d.matched).toBe(true);
    });
  });

  // ─── Boundary cases ─────────────────────────────────────────────────────────
  describe('boundary cases', () => {
    it('handles non-Error throw values (strings)', () => {
      const d = diagnoseFreighterError('User declined access.');
      expect(d.category).toBe(WALLET_DIAGNOSTIC_CATEGORIES.ACCESS_DENIED);
    });

    it('treats an empty error as an informational unknown, not error severity', () => {
      const d = diagnoseFreighterError(null);
      expect(d.matched).toBe(false);
      expect(d.category).toBe(WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN);
      expect(d.severity).toBe('warning');
    });

    it('is case-insensitive and strips a leading "Error:" prefix', () => {
      const d = diagnoseLedgerError(new Error('Error: 0X6B0C LEDGER IS LOCKED'));
      expect(d.category).toBe(WALLET_DIAGNOSTIC_CATEGORIES.HARDWARE_LOCKED);
    });

    it('reports unknown errors without matching, so they can be inspected', () => {
      const d = diagnoseLedgerError(new Error('some surprising error text'));
      expect(d.matched).toBe(false);
      expect(d.category).toBe(WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN);
      expect(d.severity).toBe('warning');
    });
  });
});
