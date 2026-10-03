import { describe, it, expect } from 'vitest';
import { StrKey } from '@stellar/stellar-sdk';
import {
  buildPaletteCommands,
  classifyPaletteQuery,
  getPaletteResults,
  getPaletteShortcutLabel,
  resolveTargetPath,
  MAX_QUERY_LENGTH,
} from '../../../src/lib/commandPalette';

const ACCOUNT = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 1));
// Flip the final character so the shape is right but the checksum is not.
const BAD_CHECKSUM_ACCOUNT = ACCOUNT.slice(0, -1) + (ACCOUNT.endsWith('A') ? 'B' : 'A');

describe('classifyPaletteQuery', () => {
  it('recognises a valid account address', () => {
    expect(classifyPaletteQuery(ACCOUNT)).toEqual({ kind: 'account', value: ACCOUNT });
  });

  it('recognises a valid contract ID', () => {
    expect(classifyPaletteQuery(CONTRACT)).toEqual({ kind: 'contract', value: CONTRACT });
  });

  it('accepts a lowercased, whitespace-padded paste', () => {
    expect(classifyPaletteQuery(`  ${ACCOUNT.toLowerCase()}  `)).toEqual({ kind: 'account', value: ACCOUNT });
  });

  it('treats ordinary words as free-text search', () => {
    expect(classifyPaletteQuery('settings')).toEqual({ kind: 'text', value: 'settings' });
    expect(classifyPaletteQuery('Go to contracts')).toEqual({ kind: 'text', value: 'Go to contracts' });
  });

  it('returns empty for blank or non-string input', () => {
    expect(classifyPaletteQuery('')).toEqual({ kind: 'empty' });
    expect(classifyPaletteQuery('   ')).toEqual({ kind: 'empty' });
    expect(classifyPaletteQuery(undefined)).toEqual({ kind: 'empty' });
    expect(classifyPaletteQuery(42)).toEqual({ kind: 'empty' });
  });

  it('rejects an address with a bad checksum', () => {
    const result = classifyPaletteQuery(BAD_CHECKSUM_ACCOUNT);
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toMatch(/checksum/i);
  });

  it('rejects a truncated address with the expected length (boundary)', () => {
    const result = classifyPaletteQuery(ACCOUNT.slice(0, 55));
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toMatch(/56 characters; this one has 55/);
  });

  it('accepts a query exactly at the length limit and rejects one past it (boundary)', () => {
    expect(classifyPaletteQuery('a'.repeat(MAX_QUERY_LENGTH)).kind).toBe('text');
    const result = classifyPaletteQuery('a'.repeat(MAX_QUERY_LENGTH + 1));
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toMatch(/too long/i);
  });
});

describe('buildPaletteCommands', () => {
  it('includes navigation, settings, and recent accounts', () => {
    const commands = buildPaletteCommands({ recentAccounts: [{ publicKey: ACCOUNT }] });
    const byId = (id: string) => commands.find((c) => c.id === id);

    expect(byId('nav-contracts')?.target).toEqual({ type: 'route', path: '/contracts' });
    expect(byId('settings-settings')?.target).toEqual({ type: 'route', path: '/settings' });
    expect(byId('settings-preferences')?.target).toEqual({ type: 'preferences' });
    expect(byId(`account-${ACCOUNT}`)?.category).toBe('Recent Accounts');
  });

  it('lists settings routes once, under Settings only', () => {
    const commands = buildPaletteCommands();
    expect(commands.filter((c) => c.target.type === 'route' && c.target.path === '/settings')).toHaveLength(1);
    expect(commands.find((c) => c.id === 'nav-settings')).toBeUndefined();
  });

  it('skips corrupted recent-account and template records instead of throwing', () => {
    const commands = buildPaletteCommands({
      recentAccounts: [null as never, { publicKey: 123 }, { publicKey: 'not-a-key' }, { publicKey: ACCOUNT }, { publicKey: ACCOUNT }],
      templates: [null as never, { id: '' }, { id: 'pay', name: 'Payment' }],
    });
    expect(commands.filter((c) => c.category === 'Recent Accounts')).toHaveLength(1);
    expect(commands.filter((c) => c.category === 'Templates').map((c) => c.label)).toEqual(['Load Template: Payment']);
  });
});

describe('getPaletteResults', () => {
  const commands = buildPaletteCommands();

  it('returns every command for an empty query', () => {
    expect(getPaletteResults(commands, { kind: 'empty' })).toBe(commands);
  });

  it('matches labels, categories, and hidden keywords', () => {
    const labels = (q: string) => getPaletteResults(commands, { kind: 'text', value: q }).map((c) => c.id);
    expect(labels('contracts')).toContain('nav-contracts');
    expect(labels('SETTINGS')).toContain('settings-featureFlags');
    expect(labels('theme')).toEqual(['settings-preferences']);
  });

  it('offers a single jump command for a valid account or contract', () => {
    const [account] = getPaletteResults(commands, { kind: 'account', value: ACCOUNT });
    expect(account.target).toEqual({ type: 'account', address: ACCOUNT });

    const results = getPaletteResults(commands, { kind: 'contract', value: CONTRACT });
    expect(results).toHaveLength(1);
    expect(results[0].target).toEqual({ type: 'contract', contractId: CONTRACT });
  });

  it('returns nothing for invalid input', () => {
    expect(getPaletteResults(commands, { kind: 'invalid', value: 'x', reason: 'bad' })).toEqual([]);
  });
});

describe('resolveTargetPath', () => {
  it('builds deep links for entities', () => {
    expect(resolveTargetPath({ type: 'account', address: ACCOUNT })).toBe(`/account/${ACCOUNT}`);
    expect(resolveTargetPath({ type: 'contract', contractId: CONTRACT })).toBe(`/contracts/${CONTRACT}`);
    expect(resolveTargetPath({ type: 'template', templateId: 't' })).toBe('/txBuilder');
  });

  it('returns null for in-page actions', () => {
    expect(resolveTargetPath({ type: 'preferences' })).toBeNull();
    expect(resolveTargetPath({ type: 'shortcuts' })).toBeNull();
  });
});

describe('getPaletteShortcutLabel', () => {
  it('uses ⌘K on Apple platforms and Ctrl+K elsewhere', () => {
    expect(getPaletteShortcutLabel({ platform: 'MacIntel' })).toBe('⌘K');
    expect(getPaletteShortcutLabel({ platform: 'Win32' })).toBe('Ctrl+K');
  });

  it('falls back to Ctrl+K when the platform is unknown', () => {
    expect(getPaletteShortcutLabel(undefined)).toBe('Ctrl+K');
    expect(getPaletteShortcutLabel({})).toBe('Ctrl+K');
  });
});
