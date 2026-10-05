import { describe, it, expect } from 'vitest';
import {
  normalizeSeverity,
  isNotificationPersistent,
  resolveDismissDuration,
  resolveAccessibilityConfig,
  SEVERITY_TAXONOMY,
  type NotificationSeverity,
} from '../notificationTaxonomy';

describe('Notification Severity Taxonomy & Accessibility Rules', () => {
  describe('Primary Flow - Severity Taxonomy Definitions', () => {
    it('defines expected accessibility roles and ARIA announcement modes', () => {
      // Info & Success should be polite status announcements
      expect(SEVERITY_TAXONOMY.info.role).toBe('status');
      expect(SEVERITY_TAXONOMY.info.ariaLive).toBe('polite');

      expect(SEVERITY_TAXONOMY.success.role).toBe('status');
      expect(SEVERITY_TAXONOMY.success.ariaLive).toBe('polite');

      // Warning, Error, Critical should be assertive alert announcements
      expect(SEVERITY_TAXONOMY.warning.role).toBe('alert');
      expect(SEVERITY_TAXONOMY.warning.ariaLive).toBe('assertive');

      expect(SEVERITY_TAXONOMY.error.role).toBe('alert');
      expect(SEVERITY_TAXONOMY.error.ariaLive).toBe('assertive');

      expect(SEVERITY_TAXONOMY.critical.role).toBe('alert');
      expect(SEVERITY_TAXONOMY.critical.ariaLive).toBe('assertive');
    });

    it('enforces default persistence rules across severity levels', () => {
      // Transient severities
      expect(isNotificationPersistent('info')).toBe(false);
      expect(isNotificationPersistent('success')).toBe(false);
      expect(isNotificationPersistent('warning')).toBe(false);

      expect(resolveDismissDuration('info')).toBe(4000);
      expect(resolveDismissDuration('success')).toBe(5000);
      expect(resolveDismissDuration('warning')).toBe(8000);

      // Persistent severities (require manual dismissal)
      expect(isNotificationPersistent('error')).toBe(true);
      expect(isNotificationPersistent('critical')).toBe(true);

      expect(resolveDismissDuration('error')).toBe(0);
      expect(resolveDismissDuration('critical')).toBe(0);
    });

    it('resolves accessibility config for component DOM bindings', () => {
      const infoA11y = resolveAccessibilityConfig('info');
      expect(infoA11y).toEqual({
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': true,
      });

      const alertA11y = resolveAccessibilityConfig('critical');
      expect(alertA11y).toEqual({
        role: 'alert',
        'aria-live': 'assertive',
        'aria-atomic': true,
      });
    });
  });

  describe('Boundary Cases - Custom Overrides & Legacy Normalization', () => {
    it('allows custom timeout overrides to make transient notifications persistent', () => {
      // An info toast explicitly marked with timeout: 0 becomes persistent
      expect(isNotificationPersistent('info', 0)).toBe(true);
      expect(resolveDismissDuration('info', 0)).toBe(0);
    });

    it('allows custom timeout overrides on persistent severities', () => {
      // An error explicitly given a 10s auto-dismiss
      expect(isNotificationPersistent('error', 10000)).toBe(false);
      expect(resolveDismissDuration('error', 10000)).toBe(10000);
    });

    it('maps legacy and variant string inputs into canonical taxonomy', () => {
      expect(normalizeSeverity('tx_confirm')).toBe('success');
      expect(normalizeSeverity('confirmed')).toBe('success');
      expect(normalizeSeverity('account_change')).toBe('info');
      expect(normalizeSeverity('network_event')).toBe('info');
      expect(normalizeSeverity('price_alert')).toBe('warning');
      expect(normalizeSeverity('warn')).toBe('warning');
      expect(normalizeSeverity('danger')).toBe('error');
      expect(normalizeSeverity('fatal')).toBe('critical');
      expect(normalizeSeverity('panic')).toBe('critical');
      expect(normalizeSeverity('emergency')).toBe('critical');

      // Case insensitivity and whitespace trimming
      expect(normalizeSeverity('  CRITICAL  ')).toBe('critical');
      expect(normalizeSeverity('WARNING')).toBe('warning');
      expect(normalizeSeverity('Error')).toBe('error');
    });
  });

  describe('Failure Cases - Invalid, Missing, or Corrupt Input Handling', () => {
    it('gracefully handles null, undefined, and non-string inputs with fallback to info', () => {
      expect(normalizeSeverity(null)).toBe('info');
      expect(normalizeSeverity(undefined)).toBe('info');
      expect(normalizeSeverity('')).toBe('info');
      expect(normalizeSeverity('unknown_unsupported_type')).toBe('info');
      expect(normalizeSeverity(123 as unknown as string)).toBe('info');
    });

    it('clamps negative custom timeout values safely to 0', () => {
      expect(resolveDismissDuration('info', -500)).toBe(0);
      expect(isNotificationPersistent('info', -500)).toBe(true);
    });
  });
});
