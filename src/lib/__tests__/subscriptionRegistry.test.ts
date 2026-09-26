import { describe, expect, it } from 'vitest'
import { getActiveSubscriptions, getSubscriptionCounts, registerSubscription } from '../subscriptionRegistry'

describe('subscription registry', () => {
  it('tracks a resource until its cleanup is called', () => {
    const close = registerSubscription('sse', 'test-account')
    expect(getSubscriptionCounts().sse).toBe(1)
    expect(getActiveSubscriptions().some((item) => item.label === 'test-account')).toBe(true)
    close()
    close()
    expect(getSubscriptionCounts().sse).toBe(0)
  })
})
