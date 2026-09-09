import { describe, expect, it } from 'vitest'
import { selfHealingManager } from './SelfHealingManager'

describe('SelfHealingManager', () => {
  it('exposes initial service statuses', () => {
    const statuses = selfHealingManager.getStatuses()

    expect(statuses.size).toBeGreaterThan(0)
    expect(statuses.get('horizon:testnet')?.health).toBe('unknown')
  })

  it('supports subscriptions and recovery updates', async () => {
    const updates: string[] = []
    const unsubscribe = selfHealingManager.subscribe(() => {
      updates.push('changed')
    })

    await selfHealingManager.healNow('horizon:testnet')

    expect(selfHealingManager.getStatuses().get('horizon:testnet')?.health).toBe('healthy')
    expect(updates.length).toBeGreaterThan(0)

    unsubscribe()
  })
})
