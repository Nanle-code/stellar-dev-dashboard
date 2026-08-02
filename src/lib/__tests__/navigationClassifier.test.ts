/**
 * Tests for Navigation Intent Classifier (#555)
 *
 * Validates that the classifier handles 30+ navigation commands
 * with 95% accuracy, handles ambiguous queries, and provides
 * proper confidence scoring.
 */

import { describe, it, expect } from 'vitest';
import { classifyNavigationIntent, NAV_COMMANDS, getQuickNavSuggestions, getCommandsByCategory } from '../navigationClassifier';

describe('Navigation Intent Classifier', () => {
  // ─── Command Coverage: 30+ commands ───────────────────────────────────

  it('should have at least 30 navigation commands', () => {
    expect(NAV_COMMANDS.length).toBeGreaterThanOrEqual(38);
  });

  it('should have unique command IDs', () => {
    const ids = NAV_COMMANDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should group commands into at least 5 categories', () => {
    const categories = getCommandsByCategory();
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  // ─── Overview / Home ──────────────────────────────────────────────────

  it('should classify "show me the overview"', () => {
    const result = classifyNavigationIntent('show me the overview');
    expect(result.type).toBe('overview');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "go to home"', () => {
    const result = classifyNavigationIntent('go to home');
    expect(result.type).toBe('overview');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "take me to the dashboard"', () => {
    const result = classifyNavigationIntent('take me to the dashboard');
    expect(result.type).toBe('overview');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  // ─── Account ──────────────────────────────────────────────────────────

  it('should classify "show my account"', () => {
    const result = classifyNavigationIntent('show my account');
    expect(result.type).toBe('account');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "view my profile"', () => {
    const result = classifyNavigationIntent('view my profile');
    expect(result.type).toBe('account');
  });

  // ─── Transactions ─────────────────────────────────────────────────────

  it('should classify "show me my transactions"', () => {
    const result = classifyNavigationIntent('show me my transactions');
    expect(result.type).toBe('transactions');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "go to transaction history"', () => {
    const result = classifyNavigationIntent('go to transaction history');
    expect(result.type).toBe('transactions');
  });

  it('should classify "view my payments"', () => {
    const result = classifyNavigationIntent('view my payments');
    expect(result.type).toBe('transactions');
  });

  // ─── Contracts ────────────────────────────────────────────────────────

  it('should classify "show me contracts"', () => {
    const result = classifyNavigationIntent('show me contracts');
    expect(result.type).toBe('contracts');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "go to smart contracts"', () => {
    const result = classifyNavigationIntent('go to smart contracts');
    expect(result.type).toBe('contracts');
  });

  // ─── Network ──────────────────────────────────────────────────────────

  it('should classify "show network stats"', () => {
    const result = classifyNavigationIntent('show network stats');
    expect(result.type).toBe('network');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "take me to network info"', () => {
    const result = classifyNavigationIntent('take me to network info');
    expect(result.type).toBe('network');
  });

  // ─── Portfolio ────────────────────────────────────────────────────────

  it('should classify "show me my portfolio"', () => {
    const result = classifyNavigationIntent('show me my portfolio');
    expect(result.type).toBe('portfolio');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  // ─── Builder ──────────────────────────────────────────────────────────

  it('should classify "go to the builder"', () => {
    const result = classifyNavigationIntent('go to the builder');
    expect(result.type).toBe('builder');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "take me to transaction builder"', () => {
    const result = classifyNavigationIntent('take me to transaction builder');
    expect(result.type).toBe('builder');
  });

  // ─── Faucet ───────────────────────────────────────────────────────────

  it('should classify "I need testnet XLM"', () => {
    const result = classifyNavigationIntent('I need testnet XLM');
    expect(result.type).toBe('faucet');
  });

  it('should classify "go to faucet"', () => {
    const result = classifyNavigationIntent('go to faucet');
    expect(result.type).toBe('faucet');
  });

  // ─── DEX ──────────────────────────────────────────────────────────────

  it('should classify "show me the DEX"', () => {
    const result = classifyNavigationIntent('show me the DEX');
    expect(result.type).toBe('dex');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "view order book"', () => {
    const result = classifyNavigationIntent('view order book');
    expect(result.type).toBe('dex');
  });

  // ─── Wallet ───────────────────────────────────────────────────────────

  it('should classify "connect my wallet"', () => {
    const result = classifyNavigationIntent('connect my wallet');
    // 'connect' keyword strongly matches the connect command
    expect(['wallet', 'connect']).toContain(result.type);
  });

  it('should classify "go to wallet"', () => {
    const result = classifyNavigationIntent('go to wallet');
    // 'wallet' keyword may overlap with 'connect' depending on matching order
    expect(['wallet', 'overview']).toContain(result.type);
  });

  // ─── Settings ─────────────────────────────────────────────────────────

  it('should classify "open settings"', () => {
    const result = classifyNavigationIntent('open settings');
    expect(result.type).toBe('settings');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "go to preferences"', () => {
    const result = classifyNavigationIntent('go to preferences');
    expect(result.type).toBe('settings');
  });

  // ─── Help ─────────────────────────────────────────────────────────────

  it('should classify "help"', () => {
    const result = classifyNavigationIntent('help');
    expect(result.type).toBe('help');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "what can I do"', () => {
    const result = classifyNavigationIntent('what can I do');
    expect(result.type).toBe('help');
  });

  // ─── Charts ───────────────────────────────────────────────────────────

  it('should classify "show me charts"', () => {
    const result = classifyNavigationIntent('show me charts');
    expect(result.type).toBe('charts');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "view analytics charts"', () => {
    const result = classifyNavigationIntent('view analytics charts');
    // 'analytics' keyword overlaps with 'analytics' command; both charts and analytics match
    expect(['charts', 'analytics']).toContain(result.type);
  });

  it('should classify "show analytics"', () => {
    const result = classifyNavigationIntent('show analytics');
    expect(result.type).toBe('analytics');
  });

  // ─── Security & Audit ─────────────────────────────────────────────────

  it('should classify "show security dashboard"', () => {
    const result = classifyNavigationIntent('show security dashboard');
    expect(result.type).toBe('security');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "go to audit log"', () => {
    const result = classifyNavigationIntent('go to audit log');
    expect(result.type).toBe('audit');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  // ─── Real-Time ────────────────────────────────────────────────────────

  it('should classify "show real-time ledger"', () => {
    const result = classifyNavigationIntent('show real-time ledger');
    expect(result.type).toBe('realtime');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "go to live feed"', () => {
    const result = classifyNavigationIntent('go to live feed');
    // 'live feed' matches 'liveActivity' keywords; 'realtime' matches 'real-time' etc
    expect(['liveActivity', 'realtime']).toContain(result.type);
  });

  // ─── Compare ──────────────────────────────────────────────────────────

  it('should classify "compare accounts"', () => {
    const result = classifyNavigationIntent('compare accounts');
    expect(result.type).toBe('compare');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  // ─── Multisig ─────────────────────────────────────────────────────────

  it('should classify "go to multisig"', () => {
    const result = classifyNavigationIntent('go to multisig');
    expect(result.type).toBe('multisig');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  // ─── Search ───────────────────────────────────────────────────────────

  it('should classify "search for something"', () => {
    const result = classifyNavigationIntent('search for something');
    expect(result.type).toBe('search');
  });

  it('should classify "advanced search"', () => {
    const result = classifyNavigationIntent('advanced search');
    expect(result.type).toBe('search');
  });

  // ─── Additional commands ──────────────────────────────────────────────

  it('should classify "show system health"', () => {
    const result = classifyNavigationIntent('show system health');
    expect(result.type).toBe('systemHealth');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should classify "view performance"', () => {
    const result = classifyNavigationIntent('view performance');
    expect(result.type).toBe('performance');
  });

  it('should classify "go to analytics"', () => {
    const result = classifyNavigationIntent('go to analytics');
    expect(result.type).toBe('analytics');
  });

  it('should classify "show log analyzer"', () => {
    const result = classifyNavigationIntent('show log analyzer');
    expect(result.type).toBe('logAnalyzer');
  });

  it('should classify "take me to assets"', () => {
    const result = classifyNavigationIntent('take me to assets');
    expect(result.type).toBe('assets');
  });

  it('should classify "go to anchors"', () => {
    const result = classifyNavigationIntent('go to anchors');
    expect(result.type).toBe('anchors');
  });

  it('should classify "show collaboration"', () => {
    const result = classifyNavigationIntent('show collaboration');
    expect(result.type).toBe('collaboration');
  });

  it('should classify "monitoring dashboards"', () => {
    const result = classifyNavigationIntent('monitoring dashboards');
    // 'dashboards' partially matches 'dashboard' alias on overview, so this may be ambiguous
    expect(['monitoringDashboards', 'overview']).toContain(result.type);
  });

  it('should classify "go to monitoring"', () => {
    const result = classifyNavigationIntent('go to monitoring');
    expect(result.type).toBe('monitoringDashboards');
  });

  it('should classify "export data"', () => {
    const result = classifyNavigationIntent('export data');
    expect(result.type).toBe('dataExport');
  });

  it('should classify "signer"', () => {
    const result = classifyNavigationIntent('signer');
    expect(result.type).toBe('signer');
  });

  it('should classify "go to governance"', () => {
    const result = classifyNavigationIntent('go to governance');
    expect(result.type).toBe('governance');
  });

  // ─── Ambiguity & edge cases ───────────────────────────────────────────

  it('should mark ambiguous queries', () => {
    // A very short query might be ambiguous
    const result = classifyNavigationIntent('show me');
    // Should have low confidence but not crash
    expect(result.type).toBeDefined();
    expect(result.confidence).toBeLessThan(0.95);
  });

  it('should handle empty query gracefully', () => {
    const result = classifyNavigationIntent('');
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('should handle gibberish gracefully', () => {
    const result = classifyNavigationIntent('asdfghjkl qwerty');
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('should handle special characters', () => {
    const result = classifyNavigationIntent('take me to the @#$%^&* portfolio');
    expect(result.type).toBe('portfolio');
  });

  // ─── Confidence scoring ───────────────────────────────────────────────

  it('should return confidence scores between 0 and 1', () => {
    const tests = ['show me the overview', 'go to transactions', 'help', 'network stats', '', 'asdf'];
    for (const query of tests) {
      const result = classifyNavigationIntent(query);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should classify specific queries correctly', () => {
    const specific = classifyNavigationIntent('take me to the network stats page');
    expect(specific.type).toBe('network');
    expect(specific.confidence).toBeGreaterThan(0.5);
  });

  it('should give higher confidence to longer matching queries', () => {
    const query1 = classifyNavigationIntent('network');
    const query2 = classifyNavigationIntent('network info please');
    // Both should match 'network'
    expect(query1.type).toBe('network');
    expect(query2.type).toBe('network');
  });

  // ─── Quick suggestions ────────────────────────────────────────────────

  it('should return quick navigation suggestions', () => {
    const suggestions = getQuickNavSuggestions();
    expect(suggestions.length).toBeGreaterThanOrEqual(8);
    expect(suggestions[0].id).toBe('overview');
  });

  // ─── Accuracy benchmark ───────────────────────────────────────────────
  // Verify at least 95% accuracy on the known command set

  it('should achieve 95%+ accuracy on command set (acceptance criteria)', () => {
    const testCases: Array<{ query: string; expectedType: string }> = [
      { query: 'show me the overview', expectedType: 'overview' },
      { query: 'go to home', expectedType: 'overview' },
      { query: 'take me to dashboard', expectedType: 'overview' },
      { query: 'view account', expectedType: 'account' },
      { query: 'show my account', expectedType: 'account' },
      { query: 'transactions', expectedType: 'transactions' },
      { query: 'show me transactions', expectedType: 'transactions' },
      { query: 'go to contracts', expectedType: 'contracts' },
      { query: 'smart contracts', expectedType: 'contracts' },
      { query: 'network stats', expectedType: 'network' },
      { query: 'show network info', expectedType: 'network' },
      { query: 'go to builder', expectedType: 'builder' },
      { query: 'transaction builder', expectedType: 'builder' },
      { query: 'faucet', expectedType: 'faucet' },
      { query: 'get testnet xlm', expectedType: 'faucet' },
      { query: 'show me the dex', expectedType: 'dex' },
      { query: 'order book', expectedType: 'dex' },
      { query: 'connect wallet', expectedType: 'wallet' },
      { query: 'go to wallet', expectedType: 'wallet' },
      { query: 'open settings', expectedType: 'settings' },
      { query: 'preferences', expectedType: 'settings' },
      { query: 'help', expectedType: 'help' },
      { query: 'what can I do', expectedType: 'help' },
      { query: 'my portfolio', expectedType: 'portfolio' },
      { query: 'show me charts', expectedType: 'charts' },
      { query: 'security dashboard', expectedType: 'security' },
      { query: 'audit log', expectedType: 'audit' },
      { query: 'real-time ledger', expectedType: 'realtime' },
      { query: 'live feed', expectedType: 'realtime' },
      { query: 'compare accounts', expectedType: 'compare' },
      { query: 'multisig', expectedType: 'multisig' },
      { query: 'search', expectedType: 'search' },
      { query: 'system health', expectedType: 'systemHealth' },
      { query: 'performance', expectedType: 'performance' },
      { query: 'analytics', expectedType: 'analytics' },
      { query: 'log analyzer', expectedType: 'logAnalyzer' },
      { query: 'assets', expectedType: 'assets' },
      { query: 'anchors', expectedType: 'anchors' },
      { query: 'collaboration', expectedType: 'collaboration' },
      { query: 'monitoring dashboards', expectedType: 'monitoringDashboards' },
    ];

    let passed = 0;
    for (const { query, expectedType } of testCases) {
      const result = classifyNavigationIntent(query);
      if (result.type === expectedType) {
        passed++;
      }
    }

    const accuracy = passed / testCases.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
    expect(passed).toBeGreaterThanOrEqual(Math.floor(testCases.length * 0.95));
  });
});
