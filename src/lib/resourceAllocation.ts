/**
 * resourceAllocation.ts
 * #625: AI-Powered Resource Allocation
 *
 * Client-side priority scheduler for the dashboard's own concurrent
 * work (API polling, WebSocket subscriptions, background jobs).
 * Allocates a limited concurrency budget across pending tasks based
 * on priority, so high-priority work isn't starved by low-priority
 * background jobs.
 *
 * Scope note: this repo is a client-side dashboard with no backend
 * infrastructure fleet, so "resource allocation" here scopes to the
 * browser-side concurrent task budget the dashboard itself controls.
 */

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export interface ResourceTask<T = unknown> {
  id: string
  priority: TaskPriority
  cost?: number
  run: () => Promise<T>
}

export interface AllocationStats {
  totalSubmitted: number
  totalCompleted: number
  totalFailed: number
  currentlyRunning: number
  currentlyQueued: number
  completedByPriority: Record<TaskPriority, number>
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 8,
  high: 4,
  medium: 2,
  low: 1,
}

const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low']

/**
 * Priority-aware concurrency scheduler. Runs up to `maxConcurrent`
 * tasks at once, always preferring higher-priority tasks, while still
 * guaranteeing lower-priority tasks eventually run (no starvation)
 * via a small round-robin allowance per priority tier.
 */
export class ResourceAllocator {
  private readonly maxConcurrent: number
  private readonly queues: Record<TaskPriority, ResourceTask[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  }
  private running = 0
  private stats: AllocationStats = {
    totalSubmitted: 0,
    totalCompleted: 0,
    totalFailed: 0,
    currentlyRunning: 0,
    currentlyQueued: 0,
    completedByPriority: { critical: 0, high: 0, medium: 0, low: 0 },
  }
  /** Tracks consecutive dispatches per tier to prevent starvation. */
  private consecutiveDispatches: Record<TaskPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  private readonly starvationLimit = 3

  constructor(maxConcurrent = 4) {
    if (maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1')
    }
    this.maxConcurrent = maxConcurrent
  }

  submit<T>(task: ResourceTask<T>): Promise<T> {
    this.stats.totalSubmitted += 1
    return new Promise<T>((resolve, reject) => {
      const wrapped: ResourceTask<T> = {
        ...task,
        run: async () => {
          try {
            const result = await task.run()
            resolve(result)
            return result
          } catch (err) {
            reject(err)
            throw err
          }
        },
      }
      this.queues[task.priority].push(wrapped as ResourceTask)
      this.dispatch()
    })
  }

  getStats(): AllocationStats {
    return {
      ...this.stats,
      currentlyRunning: this.running,
      currentlyQueued: this.queueLength(),
    }
  }

  private queueLength(): number {
    return PRIORITY_ORDER.reduce((sum, p) => sum + this.queues[p].length, 0)
  }

  /** Picks the next task to run, honoring priority weight while
   * preventing starvation: a tier that has dispatched too many tasks
   * in a row yields to the next non-empty lower tier once. */
  private pickNextTier(): TaskPriority | null {
    for (const tier of PRIORITY_ORDER) {
      if (this.queues[tier].length === 0) continue
      if (this.consecutiveDispatches[tier] < this.starvationLimit) {
        return tier
      }
    }
    // All eligible tiers hit their starvation limit — reset and pick
    // the first non-empty tier so nothing waits forever.
    for (const tier of PRIORITY_ORDER) {
      if (this.queues[tier].length > 0) {
        this.consecutiveDispatches[tier] = 0
        return tier
      }
    }
    return null
  }

  private dispatch(): void {
    while (this.running < this.maxConcurrent) {
      const tier = this.pickNextTier()
      if (!tier) break

      const task = this.queues[tier].shift()
      if (!task) continue

      this.consecutiveDispatches[tier] += 1
      for (const t of PRIORITY_ORDER) {
        if (t !== tier) this.consecutiveDispatches[t] = 0
      }

      this.running += 1
      task
        .run()
        .then(() => {
          this.stats.totalCompleted += 1
          this.stats.completedByPriority[tier] += 1
        })
        .catch(() => {
          this.stats.totalFailed += 1
        })
        .finally(() => {
          this.running -= 1
          this.dispatch()
        })
    }
  }
}

/** Relative priority weight, exposed for callers that want to reason
 * about fairness ratios without depending on internals. */
export function getPriorityWeight(priority: TaskPriority): number {
  return PRIORITY_WEIGHT[priority]
}
