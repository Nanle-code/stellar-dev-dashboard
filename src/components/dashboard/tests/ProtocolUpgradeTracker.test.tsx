/**
 * ProtocolUpgradeTracker component tests (#985).
 *
 * The loader is injected through the `data` prop so each case is deterministic:
 * primary flow (versions + upgrades + reset banner), boundary (warning-window
 * edge), and failure (malformed curated data degrades gracefully).
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtocolUpgradeTracker from '../ProtocolUpgradeTracker';

const NOW = new Date('2026-09-26T12:00:00.000Z');

function capUrl(cap: string): string {
  return `https://github.com/stellar/stellar-protocol/blob/master/core/${cap.toLowerCase()}.md`;
}

function fixture(resetDate: string | null): Record<string, unknown> {
  return {
    schemaVersion: 1,
    dataVersion: 7,
    lastUpdated: '2026-09-26',
    updateGuide: 'docs/features/protocol-upgrade-tracker.md',
    capIndexUrl: 'https://github.com/stellar/stellar-protocol/blob/master/core/README.md',
    referenceProtocolVersions: {
      mainnet: { version: 28, lastVerified: '2026-09-26', source: 'ledger header' },
      testnet: { version: 28, lastVerified: '2026-09-26', source: 'ledger header' },
      futurenet: { version: 29, lastVerified: '2026-09-26', source: 'ledger header' },
    },
    upgrades: [
      {
        protocolVersion: 29,
        status: 'in-development',
        networks: ['futurenet'],
        activationDate: null,
        activationWindow: { start: '2026-11-01', end: '2026-12-31' },
        dateConfidence: 'estimated',
        title: 'Protocol 29',
        summary: 'Next protocol window',
        impacts: ['Re-run Soroban contract tests'],
        capsNote: 'Candidates only.',
        caps: [
          {
            number: 'CAP-0088',
            title: 'Millisecond-Resolution Close Times',
            url: capUrl('CAP-0088'),
            assignment: 'tbd',
          },
        ],
      },
      {
        protocolVersion: 28,
        status: 'activated',
        networks: ['mainnet', 'testnet'],
        activationDate: null,
        activationWindow: null,
        dateConfidence: 'unknown',
        title: 'Protocol 28',
        summary: 'Currently active',
        impacts: [],
        caps: [
          {
            number: 'CAP-0083',
            title: 'Drop transaction set',
            url: capUrl('CAP-0083'),
            assignment: 'confirmed',
          },
        ],
      },
    ],
    testnetResets: [
      {
        network: 'testnet',
        scheduledFor: resetDate,
        dateConfidence: 'estimated',
        summary: 'Testnet will be wiped',
        impacts: ['Re-seed fixtures with pnpm demo:seed'],
        reSeedGuideUrl:
          'https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/features/protocol-upgrade-tracker.md#re-seeding-testnet-fixtures',
        reSeedCommand: 'pnpm demo:seed',
      },
    ],
  };
}

function renderTracker(overrides: Record<string, unknown> = {}, resetDate: string | null = null) {
  const data = { ...fixture(resetDate), ...overrides };
  return render(
    <ProtocolUpgradeTracker network="testnet" ledger={{ protocol_version: 30 }} data={data} now={NOW} />,
  );
}

describe('<ProtocolUpgradeTracker />', () => {
  afterEach(() => cleanup());

  it('renders the live protocol version per network and the upgrade list (primary flow)', () => {
    renderTracker();

    expect(screen.getByTestId('protocol-upgrade-tracker')).toBeInTheDocument();

    // Active network uses the live ledger header; others fall back to curated data.
    expect(within(screen.getByTestId('protocol-version-testnet')).getByText('30')).toBeInTheDocument();
    expect(within(screen.getByTestId('protocol-version-testnet')).getByText('LIVE')).toBeInTheDocument();
    expect(within(screen.getByTestId('protocol-version-mainnet')).getByText('28')).toBeInTheDocument();
    expect(within(screen.getByTestId('protocol-version-futurenet')).getByText('29')).toBeInTheDocument();

    // Upgrades render newest first with their CAP links.
    expect(screen.getByTestId('upgrade-29')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-28')).toBeInTheDocument();

    const capLink = screen.getByRole('link', { name: /CAP-0088/ });
    expect(capLink).toHaveAttribute('href', capUrl('CAP-0088'));
    expect(capLink).toHaveAttribute('target', '_blank');

    expect(screen.getByText(/data v7/)).toBeInTheDocument();
  });

  it('shows a reset banner with a re-seed link when a reset is inside the window (primary flow)', () => {
    renderTracker({}, '2026-09-29');

    const banner = screen.getByTestId('testnet-reset-banner');
    expect(banner).toHaveTextContent(/reset scheduled in 3 days/);
    expect(within(banner).getByRole('link', { name: /Re-seed fixtures guide/ })).toHaveAttribute(
      'href',
      'https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/features/protocol-upgrade-tracker.md#re-seeding-testnet-fixtures',
    );
    expect(banner).toHaveTextContent('pnpm demo:seed');
  });

  it('hides the banner for a reset past the warning window (boundary)', () => {
    renderTracker({}, '2026-10-11'); // 15 days out, window is 14
    expect(screen.queryByTestId('testnet-reset-banner')).not.toBeInTheDocument();
  });

  it('shows the banner on the warning-window edge (boundary)', () => {
    renderTracker({}, '2026-10-10'); // exactly 14 days out
    expect(screen.getByTestId('testnet-reset-banner')).toHaveTextContent(/in 14 days/);
  });

  it('degrades gracefully when the curated data is malformed (failure case)', () => {
    render(<ProtocolUpgradeTracker network="testnet" data={{ schemaVersion: 1 }} now={NOW} />);

    expect(screen.getByTestId('protocol-upgrades-error')).toBeInTheDocument();
    expect(screen.queryByTestId('protocol-upgrade-tracker')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/failed validation/);
    expect(screen.getByRole('alert')).toHaveTextContent(/lastUpdated/);
  });
});
