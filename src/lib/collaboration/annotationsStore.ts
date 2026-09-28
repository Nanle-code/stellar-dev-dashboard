/**
 * AnnotationsStore
 *
 * Collaborative annotations/comments system for accounts, transactions, and contracts.
 * Stores annotations in IndexedDB and syncs across tabs via BroadcastChannel.
 */

import { getStoredValue, setStoredValue } from '../storage'

export interface Annotation {
  id: string
  type: 'account' | 'transaction' | 'contract'
  targetId: string
  content: string
  authorId: string
  authorName?: string
  createdAt: number
  updatedAt: number
  resolved: boolean
}

const STORAGE_KEY = 'stellar-collaboration-annotations'
const CHANNEL_NAME = 'stellar-dashboard-annotations'

class AnnotationsStore {
  private annotations: Map<string, Annotation> = new Map()
  private channel: BroadcastChannel | null = null
  private listeners = new Set<(annotations: Annotation[]) => void>()

  async init(): Promise<void> {
    // Load annotations from IndexedDB
    try {
      const stored = await getStoredValue(STORAGE_KEY)
      if (stored && Array.isArray(stored)) {
        for (const ann of stored) {
          this.annotations.set(ann.id, ann)
        }
      }
    } catch (err) {
      console.warn('[AnnotationsStore] Failed to load annotations:', err)
    }

    // Setup BroadcastChannel for cross-tab sync
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      this.channel.onmessageerror = (err) => {
        console.warn('[AnnotationsStore] Message error:', err)
      }
    }
  }

  /**
   * Subscribe to annotation updates
   */
  subscribe(listener: (annotations: Annotation[]) => void): () => void {
    this.listeners.add(listener)
    listener(this.getAllAnnotations())
    return () => this.listeners.delete(listener)
  }

  /**
   * Get all annotations
   */
  getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    )
  }

  /**
   * Get annotations for a specific target
   */
  getAnnotationsForTarget(
    type: 'account' | 'transaction' | 'contract',
    targetId: string
  ): Annotation[] {
    return this.getAllAnnotations().filter(
      (a) => a.type === type && a.targetId === targetId && !a.resolved
    )
  }

  /**
   * Add a new annotation
   */
  async addAnnotation(
    type: 'account' | 'transaction' | 'contract',
    targetId: string,
    content: string,
    authorId: string,
    authorName?: string
  ): Promise<Annotation> {
    const annotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      targetId,
      content,
      authorId,
      authorName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resolved: false,
    }

    this.annotations.set(annotation.id, annotation)
    await this.persist()
    this.broadcast({ type: 'add', annotation })
    this.emit()

    return annotation
  }

  /**
   * Update an existing annotation
   */
  async updateAnnotation(
    id: string,
    updates: Partial<Pick<Annotation, 'content' | 'resolved'>>
  ): Promise<Annotation | null> {
    const existing = this.annotations.get(id)
    if (!existing) return null

    const updated: Annotation = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    }

    this.annotations.set(id, updated)
    await this.persist()
    this.broadcast({ type: 'update', annotation: updated })
    this.emit()

    return updated
  }

  /**
   * Delete an annotation
   */
  async deleteAnnotation(id: string): Promise<boolean> {
    const existing = this.annotations.get(id)
    if (!existing) return false

    this.annotations.delete(id)
    await this.persist()
    this.broadcast({ type: 'delete', id })
    this.emit()

    return true
  }

  /**
   * Resolve an annotation
   */
  async resolveAnnotation(id: string): Promise<boolean> {
    return (await this.updateAnnotation(id, { resolved: true })) !== null
  }

  /**
   * Get annotation count for a target
   */
  getAnnotationCount(
    type: 'account' | 'transaction' | 'contract',
    targetId: string
  ): number {
    return this.getAnnotationsForTarget(type, targetId).length
  }

  // ─── Private methods ────────────────────────────────────────────────────────

  private async persist(): Promise<void> {
    try {
      const annotations = this.getAllAnnotations()
      await setStoredValue(STORAGE_KEY, annotations)
    } catch (err) {
      console.warn('[AnnotationsStore] Failed to persist annotations:', err)
    }
  }

  private broadcast(message: {
    type: 'add' | 'update' | 'delete'
    annotation?: Annotation
    id?: string
  }): void {
    if (!this.channel) return
    try {
      this.channel.postMessage(message)
    } catch (err) {
      console.warn('[AnnotationsStore] Failed to broadcast:', err)
    }
  }

  private handleMessage(message: {
    type: 'add' | 'update' | 'delete'
    annotation?: Annotation
    id?: string
  }): void {
    switch (message.type) {
      case 'add':
      case 'update':
        if (message.annotation) {
          this.annotations.set(message.annotation.id, message.annotation)
        }
        break
      case 'delete':
        if (message.id) {
          this.annotations.delete(message.id)
        }
        break
    }
    this.emit()
  }

  private emit(): void {
    const annotations = this.getAllAnnotations()
    for (const listener of this.listeners) {
      try {
        listener(annotations)
      } catch (err) {
        console.warn('[AnnotationsStore] Listener error:', err)
      }
    }
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
    this.listeners.clear()
  }
}

// Singleton instance
export const annotationsStore = new AnnotationsStore()
