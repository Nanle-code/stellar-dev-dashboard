import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_ACTIONS,
  EMPTY_STATE_PRESETS,
  getEmptyStatePreset,
  isEmptyStateContext,
  resolveEmptyStateActions,
  type EmptyStateAction,
} from '../emptyStates';
import { getRouteById } from '../../routes/routes';

describe('emptyStates (#876)', () => {
  describe('presets', () => {
    it('every preset action targets a registered route', () => {
      for (const [key, preset] of Object.entries(EMPTY_STATE_PRESETS)) {
        for (const action of preset.actions as EmptyStateAction[]) {
          expect(getRouteById(action.routeId!), `${key} → ${action.routeId}`).toBeDefined();
        }
      }
    });

    it('falls back to the generic preset for unknown or malformed contexts', () => {
      expect(getEmptyStatePreset('doesNotExist')).toBe(EMPTY_STATE_PRESETS.generic);
      expect(getEmptyStatePreset(undefined)).toBe(EMPTY_STATE_PRESETS.generic);
      expect(getEmptyStatePreset(42)).toBe(EMPTY_STATE_PRESETS.generic);
      expect(getEmptyStatePreset('__proto__')).toBe(EMPTY_STATE_PRESETS.generic);
      expect(isEmptyStateContext('noPools')).toBe(true);
      expect(isEmptyStateContext('toString')).toBe(false);
    });
  });

  describe('resolveEmptyStateActions', () => {
    it('returns valid route actions in order (primary flow)', () => {
      const resolved = resolveEmptyStateActions(EMPTY_STATE_PRESETS.noPools.actions, { network: 'testnet' });
      expect(resolved.map((a) => a.routeId)).toEqual(['dex', 'pathExplorer', 'assets']);
    });

    it('drops actions with unknown route ids, empty labels or no target (invalid input)', () => {
      const resolved = resolveEmptyStateActions([
        { label: 'Ghost', routeId: 'not-a-route' },
        { label: '   ', routeId: 'dex' },
        { label: 'No target' },
        { label: 'Real', routeId: 'dex' },
      ]);
      expect(resolved.map((a) => a.label)).toEqual(['Real']);
    });

    it('returns an empty list for non-array input', () => {
      expect(resolveEmptyStateActions(null)).toEqual([]);
      expect(resolveEmptyStateActions(undefined)).toEqual([]);
      expect(resolveEmptyStateActions('dex' as unknown as EmptyStateAction[])).toEqual([]);
    });

    it('hides testnet-only tools on mainnet (unsupported environment)', () => {
      const mainnet = resolveEmptyStateActions(EMPTY_STATE_PRESETS.walletRequired.actions, { network: 'mainnet' });
      expect(mainnet.map((a) => a.routeId)).toEqual(['wallet']);

      const testnet = resolveEmptyStateActions(EMPTY_STATE_PRESETS.walletRequired.actions, { network: 'testnet' });
      expect(testnet.map((a) => a.routeId)).toEqual(['wallet', 'faucet']);
    });

    it('hides routes gated behind a higher expertise tier', () => {
      const actions = [{ label: 'Compliance', routeId: 'compliance' }];
      expect(resolveEmptyStateActions(actions, { expertiseLevel: 'novice' })).toEqual([]);
      expect(resolveEmptyStateActions(actions, { expertiseLevel: 'expert' })).toHaveLength(1);
    });

    it('hides routes whose feature flag is disabled', () => {
      const actions = [{ label: 'Dev toolbar', routeId: 'devToolbar' }];
      expect(resolveEmptyStateActions(actions, { isFeatureEnabled: () => false })).toEqual([]);
      expect(resolveEmptyStateActions(actions, { isFeatureEnabled: () => true })).toHaveLength(1);
    });

    it('never suggests the view the user is already on', () => {
      const resolved = resolveEmptyStateActions(EMPTY_STATE_PRESETS.noPools.actions, { currentRouteId: 'dex' });
      expect(resolved.map((a) => a.routeId)).not.toContain('dex');
    });

    it('de-duplicates targets and keeps in-page handlers', () => {
      const onSelect = () => {};
      const resolved = resolveEmptyStateActions([
        { label: 'Go to Discover', onSelect },
        { label: 'DEX', routeId: 'dex' },
        { label: 'DEX again', routeId: 'dex' },
      ]);
      expect(resolved.map((a) => a.label)).toEqual(['Go to Discover', 'DEX']);
    });

    it('caps results at maxActions (boundary)', () => {
      const actions = EMPTY_STATE_PRESETS.noPools.actions;
      expect(resolveEmptyStateActions(actions)).toHaveLength(DEFAULT_MAX_ACTIONS);
      expect(resolveEmptyStateActions(actions, { maxActions: 1 })).toHaveLength(1);
      expect(resolveEmptyStateActions(actions, { maxActions: 0 })).toEqual([]);
      expect(resolveEmptyStateActions(actions, { maxActions: -5 })).toEqual([]);
      expect(resolveEmptyStateActions(actions, { maxActions: Number.NaN })).toHaveLength(DEFAULT_MAX_ACTIONS);
    });
  });
});
