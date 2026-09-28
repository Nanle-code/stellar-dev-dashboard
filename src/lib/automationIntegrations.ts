import { buildTransaction, type BuildTransactionParams, type NetworkName } from './stellar'
import { webhookManager, type WebhookEventType } from './webhooks'

export type AutomationProvider = 'zapier' | 'make'

export interface AutomationTransaction {
  id: string
  accountId: string
  transaction: Record<string, unknown>
  timestamp: number
  type: 'payment' | 'trade' | 'contract' | 'other'
  amount?: string
  asset?: string
  from?: string
  to?: string
  status: 'success' | 'pending' | 'failed'
  network: 'mainnet' | 'testnet'
}

export interface PaymentAutomationInput {
  sourceAccount: string
  destination: string
  amount: string
  memo?: string
  network?: NetworkName
  baseFee?: number
}

export interface PaymentAutomationDraft {
  type: 'payment'
  status: 'draft'
  provider?: AutomationProvider
  params: BuildTransactionParams
}

export const automationEventTypes: WebhookEventType[] = [
  'payment',
  'trust',
  'contract',
  'account_merge',
]

export const zapierAppDefinition = {
  key: 'stellarDevDashboard',
  name: 'Stellar Dev Dashboard',
  version: '1.0.0',
  authentication: {
    type: 'custom',
    fields: [{ key: 'webhookUrl', label: 'Dashboard webhook URL', required: true }],
  },
  triggers: {
    newTransaction: {
      key: 'new_transaction',
      noun: 'Transaction',
      display: {
        label: 'New Stellar Transaction',
        description: 'Triggers when a monitored Stellar account receives a transaction.',
      },
      operation: {
        type: 'hook',
        event: 'transaction.created',
        performSubscribe: 'createZapierTransactionHook',
        performUnsubscribe: 'deleteAutomationHook',
        performList: 'listRecentAutomationEvents',
      },
    },
  },
  creates: {
    createPaymentDraft: {
      key: 'create_payment_draft',
      noun: 'Payment Draft',
      display: {
        label: 'Create Stellar Payment',
        description: 'Builds an unsigned Stellar payment transaction for signing and submission.',
      },
      operation: {
        perform: 'createAutomationPaymentDraft',
      },
    },
  },
} as const

export const makeAppDefinition = {
  name: 'stellar-dev-dashboard',
  label: 'Stellar Dev Dashboard',
  version: '1.0.0',
  modules: {
    watchTransactions: {
      type: 'trigger',
      label: 'Watch Transactions',
      webhook: true,
      event: 'transaction.created',
      output: ['id', 'accountId', 'hash', 'type', 'amount', 'asset', 'from', 'to', 'network'],
    },
    createPaymentDraft: {
      type: 'action',
      label: 'Create Payment Draft',
      input: ['sourceAccount', 'destination', 'amount', 'memo', 'network'],
      output: ['type', 'status', 'params'],
    },
  },
} as const

export function mapTransactionToWebhookEventType(
  transactionType: AutomationTransaction['type'],
): WebhookEventType {
  if (transactionType === 'payment' || transactionType === 'trade') return 'payment'
  if (transactionType === 'contract') return 'contract'
  return 'all'
}

export function createTransactionTriggerPayload(transaction: AutomationTransaction) {
  const hash =
    typeof transaction.transaction.hash === 'string'
      ? transaction.transaction.hash
      : transaction.id

  return {
    id: transaction.id,
    event: 'transaction.created',
    accountId: transaction.accountId,
    hash,
    type: transaction.type,
    amount: transaction.amount,
    asset: transaction.asset,
    from: transaction.from,
    to: transaction.to,
    status: transaction.status,
    network: transaction.network,
    occurredAt: new Date(transaction.timestamp).toISOString(),
    transaction: transaction.transaction,
  }
}

export async function createAutomationEndpoint(
  provider: AutomationProvider,
  url: string,
  events: WebhookEventType[] = ['payment', 'contract'],
) {
  return webhookManager.createEndpoint(
    url,
    events,
    {
      provider,
      integration: provider === 'zapier' ? 'Zapier' : 'Make.com',
    },
    provider,
  )
}

export async function triggerTransactionAutomation(
  transaction: AutomationTransaction,
): Promise<void> {
  await webhookManager.triggerEvent(
    mapTransactionToWebhookEventType(transaction.type),
    createTransactionTriggerPayload(transaction),
  )
}

export function createPaymentActionDraft(
  input: PaymentAutomationInput,
  provider?: AutomationProvider,
): PaymentAutomationDraft {
  const amount = input.amount.trim()

  if (!input.sourceAccount.trim()) {
    throw new Error('Source account is required')
  }

  if (!input.destination.trim()) {
    throw new Error('Destination account is required')
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error('Payment amount must be greater than zero')
  }

  return {
    type: 'payment',
    status: 'draft',
    provider,
    params: {
      sourceAccount: input.sourceAccount.trim(),
      operations: [
        {
          type: 'payment',
          destination: input.destination.trim(),
          amount,
        },
      ],
      memo: input.memo?.trim() || undefined,
      baseFee: input.baseFee ?? 100,
      timeBounds: {},
      network: input.network ?? 'testnet',
    },
  }
}

export async function executePaymentAutomationAction(
  input: PaymentAutomationInput,
  provider?: AutomationProvider,
) {
  const draft = createPaymentActionDraft(input, provider)
  const transaction = await buildTransaction(draft.params)

  return {
    ...draft,
    status: 'draft' as const,
    xdr: transaction.toXDR(),
  }
}
