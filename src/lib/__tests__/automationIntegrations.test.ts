import { describe, expect, it } from 'vitest'
import {
  createPaymentActionDraft,
  createTransactionTriggerPayload,
  makeAppDefinition,
  mapTransactionToWebhookEventType,
  zapierAppDefinition,
} from '../automationIntegrations'

describe('automationIntegrations', () => {
  it('defines Zapier transaction trigger and payment action', () => {
    expect(zapierAppDefinition.triggers.newTransaction.operation.type).toBe('hook')
    expect(zapierAppDefinition.triggers.newTransaction.operation.event).toBe(
      'transaction.created',
    )
    expect(zapierAppDefinition.creates.createPaymentDraft.operation.perform).toBe(
      'createAutomationPaymentDraft',
    )
  })

  it('defines Make.com trigger and action modules', () => {
    expect(makeAppDefinition.modules.watchTransactions.type).toBe('trigger')
    expect(makeAppDefinition.modules.watchTransactions.webhook).toBe(true)
    expect(makeAppDefinition.modules.createPaymentDraft.type).toBe('action')
  })

  it('maps transaction notifications to automation trigger payloads', () => {
    const timestamp = Date.UTC(2026, 0, 2, 3, 4, 5)
    const payload = createTransactionTriggerPayload({
      id: 'notif-1',
      accountId: 'GACCOUNT',
      transaction: { hash: 'tx-hash' },
      timestamp,
      type: 'payment',
      amount: '10',
      asset: 'XLM',
      from: 'GFROM',
      to: 'GTO',
      status: 'success',
      network: 'testnet',
    })

    expect(mapTransactionToWebhookEventType('payment')).toBe('payment')
    expect(payload).toMatchObject({
      event: 'transaction.created',
      hash: 'tx-hash',
      amount: '10',
      asset: 'XLM',
      network: 'testnet',
      occurredAt: '2026-01-02T03:04:05.000Z',
    })
  })

  it('creates payment action drafts for automation platforms', () => {
    const draft = createPaymentActionDraft(
      {
        sourceAccount: ' GSOURCE ',
        destination: ' GDEST ',
        amount: ' 12.5 ',
        memo: ' invoice-42 ',
      },
      'zapier',
    )

    expect(draft).toMatchObject({
      type: 'payment',
      status: 'draft',
      provider: 'zapier',
      params: {
        sourceAccount: 'GSOURCE',
        memo: 'invoice-42',
        baseFee: 100,
        network: 'testnet',
      },
    })
    expect(draft.params.operations).toEqual([
      { type: 'payment', destination: 'GDEST', amount: '12.5' },
    ])
  })

  it('rejects invalid payment action amounts', () => {
    expect(() =>
      createPaymentActionDraft({
        sourceAccount: 'GSOURCE',
        destination: 'GDEST',
        amount: '0',
      }),
    ).toThrow('Payment amount must be greater than zero')
  })
})
