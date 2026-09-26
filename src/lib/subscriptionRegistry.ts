export type SubscriptionKind = 'sse' | 'websocket' | 'interval' | 'listener' | 'poll'

export interface SubscriptionRecord {
  id: number
  kind: SubscriptionKind
  label: string
  openedAt: number
}

let nextId = 1
const active = new Map<number, SubscriptionRecord>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

/** Register a resource and return the idempotent cleanup function for it. */
export function registerSubscription(kind: SubscriptionKind, label: string): () => void {
  const id = nextId++
  active.set(id, { id, kind, label, openedAt: Date.now() })
  notify()
  let closed = false
  return () => {
    if (closed) return
    closed = true
    active.delete(id)
    notify()
  }
}

export function getActiveSubscriptions(): SubscriptionRecord[] {
  return [...active.values()].sort((a, b) => a.id - b.id)
}

export function getSubscriptionCounts(): Record<SubscriptionKind, number> {
  const counts: Record<SubscriptionKind, number> = { sse: 0, websocket: 0, interval: 0, listener: 0, poll: 0 }
  for (const item of active.values()) counts[item.kind] += 1
  return counts
}

export function subscribeToRegistry(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
