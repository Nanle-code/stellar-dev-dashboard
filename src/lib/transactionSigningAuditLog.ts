/**
 * Transaction Signing Audit Log (#310)
 *
 * Comprehensive audit log for all transaction signing operations.
 * Provides security/compliance tracking with timestamp, user tracking,
 * signing status, and export capabilities.
 *
 * Features:
 * - Log all signing operations (approved/rejected)
 * - Timestamp and user tracking
 * - Tamper-proof implementation using hashing
 * - Export to JSON/CSV formats
 * - Query and filtering capabilities
 */

import crypto from 'crypto'

export interface SigningAuditEntry {
  id: string
  timestamp: number
  timestampISO: string
  userId: string
  userEmail: string
  userIp?: string
  accountId: string
  transactionHash: string
  transactionSummary: string
  signingStatus: 'approved' | 'rejected' | 'pending' | 'failed'
  signingReason?: string
  signingTime?: number
  keyPath?: string
  signatureHash?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  entryHash: string
  previousEntryHash?: string
}

interface AuditLogStoreState {
  entries: SigningAuditEntry[]
  previousHash: string
  maxEntries: number
}

/**
 * Compute SHA-256 hash of entry data
 */
function computeHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Create entry hash including chain validation
 */
function createEntryHash(entry: Partial<SigningAuditEntry>, previousHash?: string): string {
  const entryData = JSON.stringify({
    timestamp: entry.timestamp,
    userId: entry.userId,
    accountId: entry.accountId,
    transactionHash: entry.transactionHash,
    signingStatus: entry.signingStatus,
    previousHash: previousHash || 'GENESIS',
  })

  return computeHash(entryData)
}

class TransactionSigningAuditLog {
  private state: AuditLogStoreState = {
    entries: [],
    previousHash: computeHash('GENESIS'),
    maxEntries: 10000,
  }

  private subscribers: Set<() => void> = new Set()
  private storageKey = 'stellar_signing_audit_log'

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  /**
   * Notify subscribers
   */
  private notify(): void {
    this.subscribers.forEach((cb) => cb())
  }

  /**
   * Load audit log from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        this.state = data
      }
    } catch (err) {
      console.warn('Failed to load audit log from storage:', err)
    }
  }

  /**
   * Save audit log to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state))
    } catch (err) {
      console.warn('Failed to save audit log to storage:', err)
    }
  }

  /**
   * Record a signing operation
   */
  recordSigning(data: {
    userId: string
    userEmail: string
    accountId: string
    transactionHash: string
    transactionSummary: string
    signingStatus: 'approved' | 'rejected' | 'pending' | 'failed'
    signingReason?: string
    signingTime?: number
    keyPath?: string
    signatureHash?: string
    userIp?: string
    userAgent?: string
    metadata?: Record<string, any>
  }): SigningAuditEntry {
    const now = Date.now()
    const entry: SigningAuditEntry = {
      id: `signing-${now}-${Math.random().toString(36).substring(7)}`,
      timestamp: now,
      timestampISO: new Date(now).toISOString(),
      userId: data.userId,
      userEmail: data.userEmail,
      userIp: data.userIp,
      accountId: data.accountId,
      transactionHash: data.transactionHash,
      transactionSummary: data.transactionSummary,
      signingStatus: data.signingStatus,
      signingReason: data.signingReason,
      signingTime: data.signingTime,
      keyPath: data.keyPath,
      signatureHash: data.signatureHash,
      ipAddress: data.userIp,
      userAgent: data.userAgent,
      metadata: data.metadata,
      entryHash: '', // Will be computed
      previousEntryHash: this.state.previousHash,
    }

    // Compute entry hash
    entry.entryHash = createEntryHash(entry, this.state.previousHash)

    // Add to log
    this.state.entries.unshift(entry)

    // Update chain
    this.state.previousHash = entry.entryHash

    // Trim if needed
    if (this.state.entries.length > this.state.maxEntries) {
      this.state.entries = this.state.entries.slice(0, this.state.maxEntries)
    }

    this.saveToStorage()
    this.notify()

    return entry
  }

  /**
   * Get all entries
   */
  getEntries(filters?: {
    userId?: string
    signingStatus?: string
    accountId?: string
    startTime?: number
    endTime?: number
    limit?: number
  }): SigningAuditEntry[] {
    let filtered = [...this.state.entries]

    if (filters) {
      if (filters.userId) {
        filtered = filtered.filter((e) => e.userId === filters.userId)
      }
      if (filters.signingStatus) {
        filtered = filtered.filter((e) => e.signingStatus === filters.signingStatus)
      }
      if (filters.accountId) {
        filtered = filtered.filter((e) => e.accountId === filters.accountId)
      }
      if (filters.startTime) {
        filtered = filtered.filter((e) => e.timestamp >= filters.startTime!)
      }
      if (filters.endTime) {
        filtered = filtered.filter((e) => e.timestamp <= filters.endTime!)
      }
      if (filters.limit) {
        filtered = filtered.slice(0, filters.limit)
      }
    }

    return filtered
  }

  /**
   * Get single entry by ID
   */
  getEntry(id: string): SigningAuditEntry | undefined {
    return this.state.entries.find((e) => e.id === id)
  }

  /**
   * Verify integrity of audit chain
   */
  verifyIntegrity(): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    let previousHash = computeHash('GENESIS')

    for (const entry of this.state.entries) {
      // Verify entry hash
      const computedHash = createEntryHash(entry, entry.previousEntryHash)
      if (computedHash !== entry.entryHash) {
        errors.push(`Entry ${entry.id} has invalid hash`)
      }

      // Verify chain continuity
      if (entry.previousEntryHash !== previousHash) {
        errors.push(`Entry ${entry.id} breaks the chain`)
      }

      previousHash = entry.entryHash
    }

    // Verify final hash
    if (previousHash !== this.state.previousHash) {
      errors.push('Final hash does not match state')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSignings: number
    approved: number
    rejected: number
    pending: number
    failed: number
    uniqueUsers: number
    uniqueAccounts: number
  } {
    const entries = this.state.entries

    return {
      totalSignings: entries.length,
      approved: entries.filter((e) => e.signingStatus === 'approved').length,
      rejected: entries.filter((e) => e.signingStatus === 'rejected').length,
      pending: entries.filter((e) => e.signingStatus === 'pending').length,
      failed: entries.filter((e) => e.signingStatus === 'failed').length,
      uniqueUsers: new Set(entries.map((e) => e.userId)).size,
      uniqueAccounts: new Set(entries.map((e) => e.accountId)).size,
    }
  }

  /**
   * Export as JSON
   */
  exportAsJSON(filters?: Parameters<typeof this.getEntries>[0]): string {
    const entries = this.getEntries(filters)
    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        totalEntries: entries.length,
        integrity: this.verifyIntegrity(),
        entries,
      },
      null,
      2,
    )
  }

  /**
   * Export as CSV
   */
  exportAsCSV(filters?: Parameters<typeof this.getEntries>[0]): string {
    const entries = this.getEntries(filters)

    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'User Email',
      'User IP',
      'Account ID',
      'Transaction Hash',
      'Transaction Summary',
      'Signing Status',
      'Signing Reason',
      'Signing Time (ms)',
      'Key Path',
      'Signature Hash',
      'Entry Hash',
      'Previous Entry Hash',
    ]

    const rows = entries.map((e) => [
      e.id,
      e.timestampISO,
      e.userId,
      e.userEmail,
      e.userIp || '',
      e.accountId,
      e.transactionHash,
      e.transactionSummary,
      e.signingStatus,
      e.signingReason || '',
      e.signingTime || '',
      e.keyPath || '',
      e.signatureHash || '',
      e.entryHash,
      e.previousEntryHash || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')

    return csvContent
  }

  /**
   * Clear all entries (use with caution)
   */
  clear(): void {
    this.state.entries = []
    this.state.previousHash = computeHash('GENESIS')
    this.saveToStorage()
    this.notify()
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.state.entries.length
  }
}

// Export singleton
export const transactionSigningAuditLog = new TransactionSigningAuditLog()

export default transactionSigningAuditLog
