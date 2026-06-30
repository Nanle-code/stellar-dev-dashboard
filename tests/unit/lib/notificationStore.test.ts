import { describe, it, expect, beforeEach } from 'vitest'
import { notificationStore } from '../../../src/lib/websocket/notificationStore'

describe('notificationStore', () => {
  beforeEach(() => {
    notificationStore.clear()
  })

  it('starts empty', () => {
    expect(notificationStore.getSnapshot()).toEqual([])
    expect(notificationStore.unreadCount()).toBe(0)
  })

  it('push() adds a notification with default level=info and read=false', () => {
    const n = notificationStore.push({ title: 'Hello', message: 'World' })
    expect(n.level).toBe('info')
    expect(n.read).toBe(false)
    expect(notificationStore.unreadCount()).toBe(1)
  })

  it('push() respects explicit level + source + payload', () => {
    const n = notificationStore.push({
      level: 'success',
      title: 'Paid',
      message: 'You got paid',
      source: 'GACCOUNT',
      payload: { amount: '100' },
    })
    expect(n.level).toBe('success')
    expect(n.source).toBe('GACCOUNT')
    expect(n.payload).toEqual({ amount: '100' })
  })

  it('newest notifications come first', () => {
    notificationStore.push({ title: 'first', message: 'a' })
    notificationStore.push({ title: 'second', message: 'b' })
    const list = notificationStore.getSnapshot()
    expect(list[0].title).toBe('second')
    expect(list[1].title).toBe('first')
  })

  it('subscribe() emits current snapshot immediately', () => {
    let snapshot: unknown = null
    const unsub = notificationStore.subscribe((s) => {
      snapshot = s
    })
    expect(Array.isArray(snapshot)).toBe(true)
    unsub()
  })

  it('subscribe() fires on push and unsub stops further calls', () => {
    let calls = 0
    const unsub = notificationStore.subscribe(() => {
      calls++
    })
    const baseline = calls
    notificationStore.push({ title: 'a', message: '1' })
    notificationStore.push({ title: 'b', message: '2' })
    unsub()
    notificationStore.push({ title: 'c', message: '3' })
    expect(calls - baseline).toBe(2)
  })

  it('markRead() marks one notification as read', () => {
    const n = notificationStore.push({ title: 'unread', message: 'm' })
    expect(notificationStore.unreadCount()).toBe(1)
    notificationStore.markRead(n.id)
    expect(notificationStore.unreadCount()).toBe(0)
  })

  it('markRead() is a no-op for unknown ids', () => {
    notificationStore.push({ title: 't', message: 'm' })
    notificationStore.markRead('missing-id')
    expect(notificationStore.unreadCount()).toBe(1)
  })

  it('markAllRead() clears the unread count', () => {
    notificationStore.push({ title: 'a', message: '1' })
    notificationStore.push({ title: 'b', message: '2' })
    notificationStore.push({ title: 'c', message: '3' })
    notificationStore.markAllRead()
    expect(notificationStore.unreadCount()).toBe(0)
  })

  it('remove() drops a single notification by id', () => {
    const a = notificationStore.push({ title: 'a', message: '1' })
    const b = notificationStore.push({ title: 'b', message: '2' })
    notificationStore.remove(a.id)
    expect(notificationStore.getSnapshot()).toHaveLength(1)
    expect(notificationStore.getSnapshot()[0].id).toBe(b.id)
  })

  it('clear() empties everything', () => {
    notificationStore.push({ title: 'a', message: '1' })
    notificationStore.push({ title: 'b', message: '2' })
    notificationStore.clear()
    expect(notificationStore.getSnapshot()).toEqual([])
  })
})
