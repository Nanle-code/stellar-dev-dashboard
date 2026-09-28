/**
 * Payment Channel support for recurring payments.
 *
 * Stellar payment channels use a two-account pattern:
 *  - A source account funded with XLM / assets
 *  - A channel account (escrow keypair) whose sequence number is bumped
 *    with each off-chain payment, allowing many cheap micro-payments between
 *    settlement transactions.
 *
 * On-chain cost model:
 *  - Standard path: N payments × 1 tx each → N × baseFee
 *  - Channel path: 1 open tx + N claim txs (off-chain, 0 fee each) + 1 close
 *    → 2 × baseFee  (plus optional settlement every M claims)
 *
 * References:
 *   https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/payment-channels-and-streaming-payments
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { getServer, NETWORKS, isValidPublicKey } from './stellar';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChannelStatus = 'open' | 'pending_close' | 'closed';

export interface PaymentChannel {
  id: string;
  /** The source / funder account that deposited funds */
  sourceAccount: string;
  /** The channel (escrow) keypair public key */
  channelAccount: string;
  /** Recipient of claimed payments */
  recipient: string;
  /** Asset code, e.g. "XLM" or "USDC" */
  assetCode: string;
  /** Asset issuer (empty string for XLM) */
  assetIssuer: string;
  /** Total deposited amount as string */
  depositedAmount: string;
  /** Running claimed total */
  claimedAmount: string;
  /** Network name */
  network: string;
  status: ChannelStatus;
  /** ISO timestamp of channel creation */
  createdAt: string;
  /** ISO timestamp of last claim */
  lastClaimAt: string | null;
  /** Number of claims processed */
  claimCount: number;
  /** Memo tag for all channel transactions */
  memo: string;
  /** Optional: close-by ledger for time-bounded channels */
  closeByLedger?: number;
}

export interface CreateChannelParams {
  sourceAccount: string;
  channelAccountPublicKey: string;
  recipient: string;
  depositAmount: string;
  assetCode: string;
  assetIssuer: string;
  network: string;
  closeByLedger?: number;
  memo?: string;
}

export interface ClaimParams {
  channelId: string;
  amount: string;
  /** Secret key of the channel (escrow) account to sign claim tx */
  channelSecretKey: string;
  network: string;
}

export interface CloseChannelParams {
  channelId: string;
  /** Secret key of the source account to sign close tx */
  sourceSecretKey: string;
  network: string;
}

export interface FeeAnalysis {
  standardCostStroops: number;
  channelCostStroops: number;
  savingsStroops: number;
  savingsPercent: number;
  breakEvenCount: number;
}

// ─── Local persistence helpers ─────────────────────────────────────────────

const STORAGE_KEY = 'payment_channels_v1';

export function loadChannels(): PaymentChannel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PaymentChannel[]) : [];
  } catch {
    return [];
  }
}

export function saveChannels(channels: PaymentChannel[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  } catch {
    // quota exceeded — ignore
  }
}

function persistChannel(channel: PaymentChannel): void {
  const existing = loadChannels().filter((c) => c.id !== channel.id);
  saveChannels([...existing, channel]);
}

function generateChannelId(): string {
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Channel creation ──────────────────────────────────────────────────────

/**
 * Build the opening transaction for a payment channel.
 *
 * Steps:
 *  1. Create the channel account from source (min reserve)
 *  2. Add trustline on channel account (non-XLM assets)
 *  3. Fund the channel account with the deposit amount
 *  4. Set the channel account options so the source can merge it later
 *
 * Returns the unsigned XDR and a new PaymentChannel record.
 */
export async function buildCreateChannelTransaction(
  params: CreateChannelParams,
): Promise<{ xdr: string; channel: PaymentChannel }> {
  const {
    sourceAccount,
    channelAccountPublicKey,
    recipient,
    depositAmount,
    assetCode,
    assetIssuer,
    network,
    closeByLedger,
    memo = '',
  } = params;

  if (!isValidPublicKey(sourceAccount)) throw new Error('Invalid source account key');
  if (!isValidPublicKey(channelAccountPublicKey)) throw new Error('Invalid channel account key');
  if (!isValidPublicKey(recipient)) throw new Error('Invalid recipient key');
  if (parseFloat(depositAmount) <= 0) throw new Error('Deposit amount must be positive');
  if (assetCode !== 'XLM' && !isValidPublicKey(assetIssuer)) {
    throw new Error('Asset issuer is required for non-XLM assets');
  }

  const server = getServer(network);
  const account = await server.loadAccount(sourceAccount);
  const passphrase = NETWORKS[network as keyof typeof NETWORKS].passphrase;

  const isNative = assetCode === 'XLM';
  const asset = isNative
    ? StellarSdk.Asset.native()
    : new StellarSdk.Asset(assetCode, assetIssuer);

  // Channel account needs 1 XLM base reserve + 0.5 XLM per entry
  // We fund it with 2 XLM to cover base + trustline reserve + buffer
  const channelReserve = isNative ? '2' : '3';

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: '200',
    networkPassphrase: passphrase,
  }).setTimeout(300);

  // 1. Create the channel (escrow) account
  txBuilder.addOperation(
    StellarSdk.Operation.createAccount({
      destination: channelAccountPublicKey,
      startingBalance: channelReserve,
    }),
  );

  // 2. For non-XLM assets, channel account needs a trustline —
  //    use sponsored reserves so the source pays for it
  if (!isNative) {
    txBuilder.addOperation(
      StellarSdk.Operation.beginSponsoringFutureReserves({
        sponsoredId: channelAccountPublicKey,
      }),
    );
    txBuilder.addOperation(
      StellarSdk.Operation.changeTrust({
        source: channelAccountPublicKey,
        asset,
      }),
    );
    txBuilder.addOperation(
      StellarSdk.Operation.endSponsoringFutureReserves({
        source: channelAccountPublicKey,
      }),
    );
  }

  // 3. Fund the channel with the deposit
  txBuilder.addOperation(
    StellarSdk.Operation.payment({
      destination: channelAccountPublicKey,
      asset,
      amount: depositAmount,
    }),
  );

  // 4. Set channel account options: add source as signer so it can close
  txBuilder.addOperation(
    StellarSdk.Operation.setOptions({
      source: channelAccountPublicKey,
      signer: {
        ed25519PublicKey: sourceAccount,
        weight: 1,
      },
    }),
  );

  if (memo) txBuilder.addMemo(StellarSdk.Memo.text(memo.slice(0, 28)));

  const tx = txBuilder.build();

  const channel: PaymentChannel = {
    id: generateChannelId(),
    sourceAccount,
    channelAccount: channelAccountPublicKey,
    recipient,
    assetCode,
    assetIssuer,
    depositedAmount: depositAmount,
    claimedAmount: '0',
    network,
    status: 'open',
    createdAt: new Date().toISOString(),
    lastClaimAt: null,
    claimCount: 0,
    memo,
    closeByLedger,
  };

  persistChannel(channel);

  return { xdr: tx.toXDR(), channel };
}

// ─── Claim (off-chain payment) ─────────────────────────────────────────────

/**
 * Build a claim transaction — the recipient calls this to collect payment.
 *
 * Each claim bumps the channel account sequence number and transfers
 * `amount` from the channel account to the recipient.
 *
 * In a real streaming-payment implementation the sender would sign these
 * transactions and hand them to the recipient without broadcasting —
 * the recipient only broadcasts the latest (highest-sequence) one.
 */
export async function buildClaimTransaction(
  channel: PaymentChannel,
  amount: string,
  network: string,
): Promise<string> {
  if (channel.status !== 'open') throw new Error('Channel is not open');

  const remaining = parseFloat(channel.depositedAmount) - parseFloat(channel.claimedAmount);
  if (parseFloat(amount) > remaining) {
    throw new Error(
      `Claim amount (${amount}) exceeds available balance (${remaining.toFixed(7)})`,
    );
  }

  const server = getServer(network);
  const channelAccount = await server.loadAccount(channel.channelAccount);
  const passphrase = NETWORKS[network as keyof typeof NETWORKS].passphrase;

  const isNative = channel.assetCode === 'XLM';
  const asset = isNative
    ? StellarSdk.Asset.native()
    : new StellarSdk.Asset(channel.assetCode, channel.assetIssuer);

  const tx = new StellarSdk.TransactionBuilder(channelAccount, {
    fee: '100',
    networkPassphrase: passphrase,
  })
    .setTimeout(300)
    .addOperation(
      StellarSdk.Operation.payment({
        destination: channel.recipient,
        asset,
        amount,
      }),
    )
    .addMemo(StellarSdk.Memo.text(`claim:${channel.id.slice(0, 16)}`))
    .build();

  return tx.toXDR();
}

/**
 * Record a processed claim and persist updated channel state.
 */
export function recordClaim(channelId: string, amount: string): PaymentChannel {
  const channels = loadChannels();
  const idx = channels.findIndex((c) => c.id === channelId);
  if (idx < 0) throw new Error(`Channel ${channelId} not found`);

  const ch = channels[idx];
  const newClaimed = (parseFloat(ch.claimedAmount) + parseFloat(amount)).toFixed(7);
  const updated: PaymentChannel = {
    ...ch,
    claimedAmount: newClaimed,
    claimCount: ch.claimCount + 1,
    lastClaimAt: new Date().toISOString(),
  };

  channels[idx] = updated;
  saveChannels(channels);
  return updated;
}

// ─── Channel closure ───────────────────────────────────────────────────────

/**
 * Build the cooperative close transaction.
 *
 * Sends all remaining channel funds back to the source account and
 * merges the channel account (recovering its XLM reserve).
 */
export async function buildCloseChannelTransaction(
  channel: PaymentChannel,
  network: string,
): Promise<string> {
  if (channel.status === 'closed') throw new Error('Channel is already closed');

  const server = getServer(network);
  const channelAccount = await server.loadAccount(channel.channelAccount);
  const passphrase = NETWORKS[network as keyof typeof NETWORKS].passphrase;

  const isNative = channel.assetCode === 'XLM';
  const asset = isNative
    ? StellarSdk.Asset.native()
    : new StellarSdk.Asset(channel.assetCode, channel.assetIssuer);

  const remaining = (
    parseFloat(channel.depositedAmount) - parseFloat(channel.claimedAmount)
  ).toFixed(7);

  const txBuilder = new StellarSdk.TransactionBuilder(channelAccount, {
    fee: '200',
    networkPassphrase: passphrase,
  })
    .setTimeout(300)
    .addMemo(StellarSdk.Memo.text(`close:${channel.id.slice(0, 15)}`));

  // Return remaining funds to source (if any balance left)
  if (!isNative && parseFloat(remaining) > 0) {
    txBuilder.addOperation(
      StellarSdk.Operation.payment({
        destination: channel.sourceAccount,
        asset,
        amount: remaining,
      }),
    );
    // Remove trustline so the reserve is freed
    txBuilder.addOperation(
      StellarSdk.Operation.changeTrust({
        asset,
        limit: '0',
      }),
    );
  }

  // Merge channel account → source account (returns XLM reserve)
  txBuilder.addOperation(
    StellarSdk.Operation.accountMerge({
      destination: channel.sourceAccount,
    }),
  );

  return txBuilder.build().toXDR();
}

/**
 * Mark a channel as closed in local state.
 */
export function markChannelClosed(channelId: string): PaymentChannel {
  const channels = loadChannels();
  const idx = channels.findIndex((c) => c.id === channelId);
  if (idx < 0) throw new Error(`Channel ${channelId} not found`);
  const updated = { ...channels[idx], status: 'closed' as ChannelStatus };
  channels[idx] = updated;
  saveChannels(channels);
  return updated;
}

/**
 * Mark a channel as pending_close while the close tx is in-flight.
 */
export function markChannelPendingClose(channelId: string): PaymentChannel {
  const channels = loadChannels();
  const idx = channels.findIndex((c) => c.id === channelId);
  if (idx < 0) throw new Error(`Channel ${channelId} not found`);
  const updated = { ...channels[idx], status: 'pending_close' as ChannelStatus };
  channels[idx] = updated;
  saveChannels(channels);
  return updated;
}

// ─── Fee analysis ──────────────────────────────────────────────────────────

/**
 * Compare on-chain cost of N direct payments vs using a channel.
 *
 * @param paymentCount Number of recurring payments planned
 * @param baseFeeStroops Network base fee in stroops (default 100)
 */
export function analyzeFeeSavings(
  paymentCount: number,
  baseFeeStroops = 100,
): FeeAnalysis {
  // Standard: every payment is its own on-chain transaction
  const standardCostStroops = paymentCount * baseFeeStroops;

  // Channel: open (1 tx, ~4 ops = 4 × fee) + close (1 tx, ~3 ops = 3 × fee)
  // Individual claims can be batched or settled periodically — we model
  // 1 settlement per 10 claims as a conservative estimate
  const openCost = 4 * baseFeeStroops;
  const closeCost = 3 * baseFeeStroops;
  const settlementCost = Math.ceil(paymentCount / 10) * baseFeeStroops;
  const channelCostStroops = openCost + closeCost + settlementCost;

  const savingsStroops = Math.max(0, standardCostStroops - channelCostStroops);
  const savingsPercent =
    standardCostStroops > 0
      ? Math.round((savingsStroops / standardCostStroops) * 100)
      : 0;

  // Break-even: how many payments before channel is cheaper
  // openCost + closeCost + ceil(n/10)*fee < n*fee  →  solve for n
  const breakEvenCount = Math.ceil((openCost + closeCost) / (baseFeeStroops - baseFeeStroops / 10));

  return {
    standardCostStroops,
    channelCostStroops,
    savingsStroops,
    savingsPercent,
    breakEvenCount: Math.max(1, breakEvenCount),
  };
}

// ─── Balance helpers ───────────────────────────────────────────────────────

export function channelAvailableBalance(channel: PaymentChannel): string {
  const available = parseFloat(channel.depositedAmount) - parseFloat(channel.claimedAmount);
  return Math.max(0, available).toFixed(7);
}

export function channelUtilizationPercent(channel: PaymentChannel): number {
  const deposited = parseFloat(channel.depositedAmount);
  if (deposited === 0) return 0;
  return Math.round((parseFloat(channel.claimedAmount) / deposited) * 100);
}
