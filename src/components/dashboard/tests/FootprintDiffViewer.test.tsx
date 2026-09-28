import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import FootprintDiffViewer from '../FootprintDiffViewer';
import type { FootprintSnapshot } from '../../../lib/footprintDiff';

afterEach(cleanup);

function key(xdr: string, type = 'LEDGER_KEY_CONTRACT_DATA') {
  return { type, xdr };
}

const BASE: FootprintSnapshot = {
  readOnly: [key('ro-a'), key('ro-b')],
  readWrite: [key('rw-a')],
  minResourceFee: '1000',
};

const CHANGED: FootprintSnapshot = {
  readOnly: [key('ro-a'), key('ro-c')],
  readWrite: [key('rw-a'), key('rw-b', 'LEDGER_KEY_LIQUIDITY_POOL')],
  minResourceFee: '1600',
};

describe('FootprintDiffViewer', () => {
  it('renders nothing when there is no current footprint', () => {
    const { container } = render(
      <FootprintDiffViewer previousFootprint={null} currentFootprint={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('summarizes the current footprint when no previous simulation exists', () => {
    render(<FootprintDiffViewer previousFootprint={null} currentFootprint={BASE} />);
    expect(screen.getByText(/run the simulation again/i)).toBeInTheDocument();
    expect(screen.getByText(/2 read-only, 1 read-write keys/i)).toBeInTheDocument();
  });

  it('shows added and removed keys between simulations (primary flow)', () => {
    render(<FootprintDiffViewer previousFootprint={BASE} currentFootprint={CHANGED} />);

    expect(screen.getByText('2 added')).toBeInTheDocument();
    expect(screen.getByText('1 removed')).toBeInTheDocument();
    expect(screen.getByText(/read-only \(1 added, 1 removed\)/i)).toBeInTheDocument();
    expect(screen.getByText(/600 fee delta/i)).toBeInTheDocument();
    expect(screen.getByText(/unexpected write/i)).toBeInTheDocument();
  });

  it('hides unchanged keys by default and reveals them on toggle (boundary)', () => {
    render(<FootprintDiffViewer previousFootprint={BASE} currentFootprint={BASE} />);

    expect(screen.getByText(/footprints are identical/i)).toBeInTheDocument();
    expect(screen.queryByText(/LEDGER_KEY_CONTRACT_DATA/)).not.toBeInTheDocument();

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);
    expect(screen.getAllByText(/LEDGER_KEY_CONTRACT_DATA/).length).toBeGreaterThan(0);
  });

  it('surfaces a clear error for a malformed current footprint (failure path)', () => {
    const malformed = {
      readOnly: [{ type: 'x', xdr: '' }],
      readWrite: [],
      minResourceFee: '0',
    } as unknown as FootprintSnapshot;

    render(<FootprintDiffViewer previousFootprint={null} currentFootprint={malformed} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid ledger key/i);
  });

  it('catches errors from a malformed baseline without crashing (failure path)', () => {
    const malformedBaseline = {
      readOnly: [{ type: 'x' }],
      readWrite: [],
      minResourceFee: '1000',
    } as unknown as FootprintSnapshot;

    render(<FootprintDiffViewer previousFootprint={malformedBaseline} currentFootprint={BASE} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/baseline footprint.*malformed/i);
  });
});
