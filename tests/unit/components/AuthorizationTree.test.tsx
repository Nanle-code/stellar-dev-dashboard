/**
 * Tests for AuthorizationTree (#850)
 *
 * Covers:
 *  - Primary flow: renders auth entries with signer credentials and invocation tree.
 *  - Boundary cases: empty entries array, deeply-nested sub-invocations, address
 *    credential with long address, multiple signers, unknown function types.
 *  - Failure cases: null/undefined entries, non-array value, malformed entry.
 *
 * Testing pattern follows ResourceMetrics.test.tsx: direct component imports with
 * vi.mock for dependencies.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import AuthorizationTree from '../../../src/components/dashboard/AuthorizationTree';
import type {
  SerializedAuthEntry,
  SerializedAuthInvocation,
} from '../../../src/lib/stellar';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONTRACT_ADDR =
  'CCJJUDP3ZY7YTQCVHV2BRTUMQKQAHLJIMYTCGVOFG5NQZR3FW6GKU7O';

function makeContractFnInvocation(
  functionName: string,
  contractAddress = CONTRACT_ADDR,
  subInvocations: SerializedAuthInvocation[] = [],
): SerializedAuthInvocation {
  return {
    functionType: 'contract_fn',
    contractAddress,
    functionName,
    args: [],
    subInvocations,
  };
}

const sourceAccountEntry: SerializedAuthEntry = {
  credentials: { type: 'source_account' },
  rootInvocation: makeContractFnInvocation('transfer'),
};

const addressEntry: SerializedAuthEntry = {
  credentials: {
    type: 'address',
    address: 'GBXLTPJHZJGGFG5NQZR3FW6GKU7OCCJJUDP3ZY7YTQCVHV2BRTUMQKA',
    nonce: '12345678',
    signatureExpirationLedger: 9_876_543,
  },
  rootInvocation: makeContractFnInvocation('approve'),
};

const nestedEntry: SerializedAuthEntry = {
  credentials: { type: 'source_account' },
  rootInvocation: makeContractFnInvocation('swap', CONTRACT_ADDR, [
    makeContractFnInvocation('transfer', CONTRACT_ADDR, [
      makeContractFnInvocation('emit_event'),
    ]),
  ]),
};

const unknownFnEntry: SerializedAuthEntry = {
  credentials: { type: 'source_account' },
  rootInvocation: {
    functionType: 'unknown',
    contractAddress: '',
    functionName: '',
    args: [],
    subInvocations: [],
  },
};

const createContractEntry: SerializedAuthEntry = {
  credentials: { type: 'source_account' },
  rootInvocation: {
    functionType: 'create_contract',
    contractAddress: '',
    functionName: '',
    args: [],
    subInvocations: [],
  },
};

// ─── Primary flow ─────────────────────────────────────────────────────────────

describe('AuthorizationTree — primary flow', () => {
  it('renders the panel heading and signer count badge', () => {
    render(<AuthorizationTree authEntries={[sourceAccountEntry]} />);

    expect(screen.getByText('Authorization Requirements')).toBeInTheDocument();
    // Badge label
    expect(screen.getByText('1 signer')).toBeInTheDocument();
  });

  it('renders source account credentials badge', () => {
    render(<AuthorizationTree authEntries={[sourceAccountEntry]} />);

    expect(screen.getByText('Source Account')).toBeInTheDocument();
    expect(screen.getByText('(transaction signer)')).toBeInTheDocument();
  });

  it('renders function name from root invocation', () => {
    render(<AuthorizationTree authEntries={[sourceAccountEntry]} />);

    expect(screen.getByText('transfer')).toBeInTheDocument();
  });

  it('renders address credential with address, nonce, and expiry ledger', () => {
    render(<AuthorizationTree authEntries={[addressEntry]} />);

    expect(screen.getByText('Address Signature Required')).toBeInTheDocument();
    expect(
      screen.getByText('GBXLTPJHZJGGFG5NQZR3FW6GKU7OCCJJUDP3ZY7YTQCVHV2BRTUMQKA'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nonce: 12345678/)).toBeInTheDocument();
    expect(screen.getByText(/Expires ledger: 9876543/)).toBeInTheDocument();
  });

  it('renders a security notice', () => {
    render(<AuthorizationTree authEntries={[sourceAccountEntry]} />);
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByText(/Review all authorization entries before signing/)).toBeInTheDocument();
  });

  it('marks the panel as a tree for accessibility', () => {
    render(<AuthorizationTree authEntries={[sourceAccountEntry]} />);
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });
});

// ─── Boundary cases ───────────────────────────────────────────────────────────

describe('AuthorizationTree — boundary cases', () => {
  it('returns null (renders nothing) for an empty entries array', () => {
    const { container } = render(<AuthorizationTree authEntries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders plural signer badge for multiple entries', () => {
    render(<AuthorizationTree authEntries={[sourceAccountEntry, addressEntry]} />);

    expect(screen.getByText('2 signers')).toBeInTheDocument();
  });

  it('renders multiple signer sections labeled Signer 1, Signer 2', () => {
    render(<AuthorizationTree authEntries={[sourceAccountEntry, addressEntry]} />);

    expect(screen.getByText('Signer 1')).toBeInTheDocument();
    expect(screen.getByText('Signer 2')).toBeInTheDocument();
  });

  it('renders nested sub-invocations in the tree', () => {
    render(<AuthorizationTree authEntries={[nestedEntry]} />);

    // Root function
    expect(screen.getByText('swap')).toBeInTheDocument();
    // First-level sub-invocation
    expect(screen.getByText('transfer')).toBeInTheDocument();
    // Second-level sub-invocation
    expect(screen.getByText('emit_event')).toBeInTheDocument();
  });

  it('shows sub-invocation count badge on nodes with children', () => {
    render(<AuthorizationTree authEntries={[nestedEntry]} />);

    // The root node 'swap' has 1 sub-invocation; the badge should appear.
    // nestedEntry also has 'transfer' with 1 sub-invocation, so there are two
    // badges with aria-label "1 sub-invocation".
    const badges = screen.getAllByLabelText('1 sub-invocation');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('collapses and re-expands a node with sub-invocations', () => {
    render(<AuthorizationTree authEntries={[nestedEntry]} />);

    // 'swap' is the root treeitem (depth 0). There may be multiple matching
    // treeitems; we want the first (outermost) expanded node.
    const treeItems = screen.getAllByRole('treeitem', { name: /1 sub-invocation/ });
    const swapNode = treeItems[0];
    fireEvent.click(swapNode);

    // After collapse, 'transfer' (child) should no longer be visible.
    expect(screen.queryByText('transfer')).not.toBeInTheDocument();

    // Click again to expand.
    fireEvent.click(swapNode);
    expect(screen.getByText('transfer')).toBeInTheDocument();
  });

  it('renders create_contract function type label', () => {
    render(<AuthorizationTree authEntries={[createContractEntry]} />);
    expect(screen.getByText('create_contract')).toBeInTheDocument();
  });

  it('renders unknown function type fallback label', () => {
    render(<AuthorizationTree authEntries={[unknownFnEntry]} />);
    expect(screen.getByText('(unknown)')).toBeInTheDocument();
  });

  it('truncates long contract addresses in invocation node', () => {
    // CONTRACT_ADDR is 56 chars — longer than the truncation threshold.
    render(<AuthorizationTree authEntries={[sourceAccountEntry]} />);
    // Full address should NOT appear as visible text (it's in the title attribute).
    const node = screen.queryByText(CONTRACT_ADDR);
    expect(node).not.toBeInTheDocument();
  });
});

// ─── Failure / invalid input cases ───────────────────────────────────────────

describe('AuthorizationTree — failure cases', () => {
  it('returns null when authEntries is undefined', () => {
    // Simulate a caller passing an older result that lacks authEntries.
    const { container } = render(
      <AuthorizationTree authEntries={undefined as unknown as []} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when authEntries is null', () => {
    const { container } = render(
      <AuthorizationTree authEntries={null as unknown as []} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when authEntries is not an array', () => {
    const { container } = render(
      <AuthorizationTree authEntries={'bad-value' as unknown as []} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders without crashing when invocation has an empty function name', () => {
    const entry: SerializedAuthEntry = {
      credentials: { type: 'source_account' },
      rootInvocation: {
        functionType: 'contract_fn',
        contractAddress: CONTRACT_ADDR,
        functionName: '',
        args: [],
        subInvocations: [],
      },
    };
    render(<AuthorizationTree authEntries={[entry]} />);
    // Falls back to placeholder label
    expect(screen.getByText('(unknown function)')).toBeInTheDocument();
  });

  it('renders without crashing when invocation has no args and no sub-invocations', () => {
    const entry: SerializedAuthEntry = {
      credentials: { type: 'source_account' },
      rootInvocation: {
        functionType: 'contract_fn',
        contractAddress: CONTRACT_ADDR,
        functionName: 'noop',
        args: [],
        subInvocations: [],
      },
    };
    // Should not throw and should render the function name.
    render(<AuthorizationTree authEntries={[entry]} />);
    expect(screen.getByText('noop')).toBeInTheDocument();
  });

  it('renders without crashing for a create_contract_v2 function type', () => {
    const entry: SerializedAuthEntry = {
      credentials: { type: 'source_account' },
      rootInvocation: {
        functionType: 'create_contract_v2',
        contractAddress: '',
        functionName: '',
        args: [],
        subInvocations: [],
      },
    };
    render(<AuthorizationTree authEntries={[entry]} />);
    expect(screen.getByText('create_contract_v2')).toBeInTheDocument();
  });
});
