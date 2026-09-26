import { describe, it, expect } from 'vitest'
import {
  parseWebhookSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../webhookSignatures'

describe('webhookSignatures', () => {
  const secret = 'test-secret-key'
  const rawBody = JSON.stringify({ event: 'payment', amount: '10' })

  it('signs and verifies a webhook payload', async () => {
    const timestamp = 1_700_000_000
    const signature = await signWebhookPayload(rawBody, secret, timestamp)

    const result = await verifyWebhookSignature(rawBody, signature, secret, {
      now: timestamp,
      toleranceSeconds: 300,
    })

    expect(result.valid).toBe(true)
    expect(result.timestamp).toBe(timestamp)
  })

  it('rejects tampered payloads', async () => {
    const timestamp = 1_700_000_000
    const signature = await signWebhookPayload(rawBody, secret, timestamp)

    const result = await verifyWebhookSignature(`${rawBody}tampered`, signature, secret, {
      now: timestamp,
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('signature_mismatch')
  })

  it('rejects malformed signature headers', async () => {
    const result = await verifyWebhookSignature(rawBody, 'invalid-header', secret)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('malformed_signature')
  })

  it('rejects signatures outside replay tolerance', async () => {
    const timestamp = 1_700_000_000
    const signature = await signWebhookPayload(rawBody, secret, timestamp)

    const result = await verifyWebhookSignature(rawBody, signature, secret, {
      now: timestamp + 600,
      toleranceSeconds: 300,
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('timestamp_out_of_tolerance')
  })

  it('parses signature headers with version prefix', () => {
    const parsed = parseWebhookSignatureHeader('t=1700000000,v1=abc123')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.timestamp).toBe(1700000000)
      expect(parsed.signature).toBe('abc123')
    }
  })
})
