export const OPERATION_LABELS: Record<string, string> = {
  create_account: 'Create Account',
  payment: 'Payment',
  path_payment_strict_send: 'Path Payment (Send)',
  path_payment_strict_receive: 'Path Payment (Receive)',
  manage_buy_offer: 'Buy Offer',
  manage_sell_offer: 'Sell Offer',
  create_passive_sell_offer: 'Create Passive Sell Offer',
  set_options: 'Set Options',
  change_trust: 'Change Trust',
  allow_trust: 'Allow Trust',
  account_merge: 'Account Merge',
  manage_data: 'Manage Data',
  bump_sequence: 'Bump Sequence',
  create_claimable_balance: 'Create Claimable Balance',
  claim_claimable_balance: 'Claim Claimable Balance',
  begin_sponsoring_future_reserves: 'Begin Sponsoring Future Reserves',
  end_sponsoring_future_reserves: 'End Sponsoring Future Reserves',
  revoke_sponsorship: 'Revoke Sponsorship',
  clawback: 'Clawback',
  clawback_claimable_balance: 'Clawback Claimable Balance',
  set_trust_line_flags: 'Set Trustline Flags',
  liquidity_pool_deposit: 'Liquidity Pool Deposit',
  liquidity_pool_withdraw: 'Liquidity Pool Withdraw',
  invoke_host_function: 'Contract Call',
  extend_footprint_ttl: 'Extend Footprint TTL',
  restore_footprint: 'Restore Footprint',
};

export function getOperationLabel(type: string): string {
  return OPERATION_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}