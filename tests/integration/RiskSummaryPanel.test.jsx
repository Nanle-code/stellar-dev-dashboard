import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as Sdk from '@stellar/stellar-sdk';

import RiskSummaryPanel from '../../src/components/security/RiskSummaryPanel';
import { computeRiskSummary } from '../../src/lib/riskSummary';

/**
 * Integration coverage for the pre-sign risk dialog.
 *
 * The critical property under test is the one the issue is really about: a
 * transaction that is flagged as high risk must not be signable until the user
 * has actively acknowledged it, and an unflagged transaction must not be
 * slowed down by an extra step.
 */

const KP_A = Sdk.Keypair.random();
const KP_B = Sdk.Keypair.random();
const A = KP_A.publicKey();
const B = KP_B.publicKey();
const NATIVE = Sdk.Asset.native();

const buildTx = (descriptors) => {
  const builder = new Sdk.TransactionBuilder(new Sdk.Account(A, '100'), {
    fee: Sdk.BASE_FEE,
    networkPassphrase: Sdk.Networks.TESTNET,
  });
  for (const descriptor of descriptors) builder.addOperation(descriptor);
  return builder.setTimeout(300).build();
};

const summaryFor = (descriptors, context = {}) => computeRiskSummary(buildTx(descriptors), context);

const renderPanel = (props) =>
  render(
    <RiskSummaryPanel
      summary={summaryFor([Sdk.Operation.accountMerge({ destination: B })])}
      onAcknowledged={props.onAcknowledged}
      onCancel={props.onCancel}
      proceedLabel="Sign Transaction"
      {...props}
    />
  );

describe('RiskSummaryPanel', () => {
  let originalOverflow;

  beforeEach(() => {
    originalOverflow = document.body.style.overflow;
  });

  afterEach(() => {
    document.body.style.overflow = originalOverflow;
  });

  it('renders nothing without a summary', () => {
    const { container } = render(<RiskSummaryPanel summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes an accessible alertdialog labelled by its heading', () => {
    renderPanel({ onAcknowledged: vi.fn(), onCancel: vi.fn() });
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByRole('heading', { name: /review before signing/i })
    ).toBeInTheDocument();
  });

  it('states that nothing has been signed yet', () => {
    renderPanel({ onAcknowledged: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByText(/nothing has been signed yet/i)).toBeInTheDocument();
  });

  it('shows the overall severity badge', () => {
    renderPanel({ onAcknowledged: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByTestId('risk-overall-badge')).toHaveTextContent(/high/i);
  });

  it('lists the flagged rule in plain language with its id', () => {
    renderPanel({ onAcknowledged: vi.fn(), onCancel: vi.fn() });
    const rule = screen.getByTestId('risk-rule-account-merge');
    expect(rule).toHaveTextContent(/permanently deleted/i);
    expect(rule).toHaveTextContent('account-merge');
  });

  it('shows the source account', () => {
    renderPanel({ onAcknowledged: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByText(A)).toBeInTheDocument();
  });

  describe('acknowledgement gating', () => {
    it('disables proceeding until a high-risk summary is acknowledged', async () => {
      const user = userEvent.setup();
      const onAcknowledged = vi.fn();
      renderPanel({ onAcknowledged, onCancel: vi.fn() });

      const proceed = screen.getByRole('button', { name: /sign transaction/i });
      expect(proceed).toBeDisabled();

      await user.click(screen.getByRole('checkbox'));
      expect(proceed).toBeEnabled();

      await user.click(proceed);
      expect(onAcknowledged).toHaveBeenCalledTimes(1);
    });

    it('blocks an unacknowledged sign even if the button is activated programmatically', async () => {
      const onAcknowledged = vi.fn();
      renderPanel({ onAcknowledged, onCancel: vi.fn() });
      const proceed = screen.getByRole('button', { name: /sign transaction/i });
      // A disabled button is the guarantee; assert the handler never fires.
      proceed.click();
      expect(onAcknowledged).not.toHaveBeenCalled();
    });

    it('offers no checkbox when nothing requires acknowledgement', () => {
      render(
        <RiskSummaryPanel
          summary={summaryFor([
            Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' }),
          ])}
          onAcknowledged={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('lets a low-risk transaction proceed immediately', async () => {
      const user = userEvent.setup();
      const onAcknowledged = vi.fn();
      render(
        <RiskSummaryPanel
          summary={summaryFor([
            Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' }),
          ])}
          onAcknowledged={onAcknowledged}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByTestId('risk-overall-badge')).toHaveTextContent(/no risk/i);
      await user.click(screen.getByRole('button', { name: /proceed to wallet/i }));
      expect(onAcknowledged).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancellation', () => {
    it('cancels from the button', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      const onAcknowledged = vi.fn();
      renderPanel({ onAcknowledged, onCancel });
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onCancel).toHaveBeenCalled();
      expect(onAcknowledged).not.toHaveBeenCalled();
    });

    it('cancels on Escape', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      renderPanel({ onAcknowledged: vi.fn(), onCancel });
      await user.keyboard('{Escape}');
      expect(onCancel).toHaveBeenCalled();
    });

    it('cancels when the backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      renderPanel({ onAcknowledged: vi.fn(), onCancel });
      await user.click(screen.getByTestId('risk-summary-backdrop'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('accessibility behaviour', () => {
    it('locks background scrolling while open and restores it on unmount', () => {
      const { unmount } = renderPanel({ onAcknowledged: vi.fn(), onCancel: vi.fn() });
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });

    it('moves focus into the dialog on open', () => {
      renderPanel({ onAcknowledged: vi.fn(), onCancel: vi.fn() });
      const dialog = screen.getByRole('alertdialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  describe('multi-operation transactions', () => {
    it('numbers each operation and keeps severities independent', () => {
      render(
        <RiskSummaryPanel
          summary={summaryFor([
            Sdk.Operation.accountMerge({ destination: B }),
            Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' }),
          ])}
          onAcknowledged={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByTestId('risk-severity-0')).toHaveTextContent(/high/i);
      expect(screen.getByTestId('risk-severity-1')).toHaveTextContent(/no risk/i);
      expect(screen.getByText(/2 operations in this transaction/i)).toBeInTheDocument();
    });

    it('says so plainly when an operation matched no rule', () => {
      render(
        <RiskSummaryPanel
          summary={summaryFor([
            Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' }),
          ])}
          onAcknowledged={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByText(/no risk pattern matched this operation/i)).toBeInTheDocument();
    });
  });

  describe('unknown Soroban contracts', () => {
    const contractId = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
    const invokeTx = () =>
      buildTx([
        new Sdk.Contract(contractId).call('transfer', Sdk.nativeToScVal(1n, { type: 'i128' })),
      ]);

    it('offers to add an unknown contract to the known list', async () => {
      const user = userEvent.setup();
      const onTrustContract = vi.fn();
      render(
        <RiskSummaryPanel
          summary={computeRiskSummary(invokeTx(), { knownContracts: [] })}
          onAcknowledged={vi.fn()}
          onCancel={vi.fn()}
          onTrustContract={onTrustContract}
        />
      );
      await user.click(screen.getByRole('button', { name: /add this contract to my known list/i }));
      expect(onTrustContract).toHaveBeenCalledTimes(1);
    });

    it('hides that affordance when the contract is already known', () => {
      render(
        <RiskSummaryPanel
          summary={computeRiskSummary(invokeTx(), { knownContracts: [contractId] })}
          onAcknowledged={vi.fn()}
          onCancel={vi.fn()}
          onTrustContract={vi.fn()}
        />
      );
      expect(
        screen.queryByRole('button', { name: /add this contract to my known list/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('simulation reporting', () => {
    it('reports a successful simulation with its resource fee', () => {
      render(
        <RiskSummaryPanel
          summary={computeRiskSummary(buildTx([Sdk.Operation.accountMerge({ destination: B })]), {
            simulation: { minResourceFee: '2500', events: [] },
          })}
          onAcknowledged={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(screen.getByText(/simulation complete/i)).toHaveTextContent(/2500 stroops/);
    });

    it('discloses a failed simulation without blocking the flow', () => {
      const summary = computeRiskSummary(
        buildTx([Sdk.Operation.accountMerge({ destination: B })]),
        { simulation: { error: 'node unreachable' } }
      );
      render(<RiskSummaryPanel summary={summary} onAcknowledged={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByText(/simulation did not complete/i)).toBeInTheDocument();
      expect(screen.getByText(/node unreachable/)).toBeInTheDocument();
      // The transaction is still flagged, so it still requires acknowledgement.
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });

  it('discloses engine-level notes such as a missing account snapshot', () => {
    render(
      <RiskSummaryPanel
        summary={computeRiskSummary(buildTx([Sdk.Operation.accountMerge({ destination: B })]), {})}
        onAcknowledged={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/no account snapshot/i)).toBeInTheDocument();
  });
});
