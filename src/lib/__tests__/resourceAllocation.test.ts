import { describe, it, expect } from 'vitest'
import { ResourceAllocator, getPriorityWeight } from '../resourceAllocation'

function makeTask(id: string, priority: any, ms = 5) {
  return {
    id,
    priority,
    run: () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve(id), ms)
      }),
  }
}

describe('ResourceAllocator', () => {
  it('respects the maxConcurrent limit', async () => {
    const allocator = new ResourceAllocator(2)
    let peak = 0
    const tasks = Array.from({ length: 6 }, (_, i) =>
      allocator.submit({
        id: `t${i}`,
        priority: 'medium' as const,
        run: async () => {
          peak = Math.max(peak, allocator.getStats().currentlyRunning)
          await new Promise((r) => setTimeout(r, 10))
          return i
        },
      }),
    )
    await Promise.all(tasks)
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('runs critical tasks before low priority tasks queued while busy', async () => {
    const allocator = new ResourceAllocator(1)
    const order: string[] = []
    const record = (id: string) => order.push(id)

    // Occupy the single slot first so low/critical both queue up
    // behind it, creating real contention between priorities.
    const blocker = allocator.submit({
      id: 'blocker',
      priority: 'medium',
      run: () => new Promise((resolve) => setTimeout(resolve, 20)),
    })

    const low = allocator.submit({
      id: 'low',
      priority: 'low',
      run: async () => {
        record('low')
      },
    })
    const critical = allocator.submit({
      id: 'critical',
      priority: 'critical',
      run: async () => {
        record('critical')
      },
    })

    await Promise.all([blocker, low, critical])
    expect(order[0]).toBe('critical')
  })

  it('rejects an invalid maxConcurrent', () => {
    expect(() => new ResourceAllocator(0)).toThrow()
  })

  it('tracks completion stats by priority', async () => {
    const allocator = new ResourceAllocator(3)
    await Promise.all([
      allocator.submit(makeTask('a', 'high')),
      allocator.submit(makeTask('b', 'high')),
      allocator.submit(makeTask('c', 'low')),
    ])
    const stats = allocator.getStats()
    expect(stats.totalCompleted).toBe(3)
    expect(stats.completedByPriority.high).toBe(2)
    expect(stats.completedByPriority.low).toBe(1)
  })

  it('tracks failures without blocking other tasks', async () => {
    const allocator = new ResourceAllocator(2)
    const failing = allocator
      .submit({
        id: 'fail',
        priority: 'high',
        run: async () => {
          throw new Error('boom')
        },
      })
      .catch(() => 'caught')
    const ok = allocator.submit(makeTask('ok', 'high'))

    await Promise.all([failing, ok])
    const stats = allocator.getStats()
    expect(stats.totalFailed).toBe(1)
    expect(stats.totalCompleted).toBe(1)
  })

  it('prevents starvation: low priority tasks eventually run under sustained high-priority load', async () => {
    const allocator = new ResourceAllocator(1)
    const completedOrder: string[] = []

    const low = allocator.submit({
      id: 'low',
      priority: 'low',
      run: async () => {
        completedOrder.push('low')
      },
    })

    const highs = Array.from({ length: 10 }, (_, i) =>
      allocator.submit({
        id: `high${i}`,
        priority: 'high',
        run: async () => {
          completedOrder.push(`high${i}`)
        },
      }),
    )

    await Promise.all([low, ...highs])
    expect(completedOrder).toContain('low')
    expect(completedOrder.indexOf('low')).toBeLessThan(completedOrder.length - 1)
  })

  it('exposes relative priority weights', () => {
    expect(getPriorityWeight('critical')).toBeGreaterThan(getPriorityWeight('high'))
    expect(getPriorityWeight('high')).toBeGreaterThan(getPriorityWeight('medium'))
    expect(getPriorityWeight('medium')).toBeGreaterThan(getPriorityWeight('low'))
  })
})
