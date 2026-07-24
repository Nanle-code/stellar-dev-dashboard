/**
 * Hook for Transaction Signing Audit Log (#310)
 */

import { useEffect, useState, useCallback } from 'react'
import { transactionSigningAuditLog } from '../lib/transactionSigningAuditLog'
import type { SigningAuditEntry } from '../lib/transactionSigningAuditLog'

export interface UseTransactionSigningAuditResult {
  entries: SigningAuditEntry[]
  recordSigning: (data: {
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
  }) => SigningAuditEntry
  getEntries: (filters?: {
    userId?: string
    signingStatus?: string
    accountId?: string
    startTime?: number
    endTime?: number
    limit?: number
  }) => SigningAuditEntry[]
  verifyIntegrity: () => {
    isValid: boolean
    errors: string[]
  }
  getStats: () => {
    totalSignings: number
    approved: number
    rejected: number
    pending: number
    failed: number
    uniqueUsers: number
    uniqueAccounts: number
  }
  exportAsJSON: (filters?: any) => string
  exportAsCSV: (filters?: any) => string
  clear: () => void
  getEntryCount: () => number
}

export function useTransactionSigningAudit(): UseTransactionSigningAuditResult {
  const [entries, setEntries] = useState<SigningAuditEntry[]>(() =>
    transactionSigningAuditLog.getEntries(),
  )

  useEffect(() => {
    const unsubscribe = transactionSigningAuditLog.subscribe(() => {
      setEntries(transactionSigningAuditLog.getEntries())
    })

    return unsubscribe
  }, [])

  const recordSigning = useCallback(
    (data: Parameters<typeof transactionSigningAuditLog.recordSigning>[0]) => {
      return transactionSigningAuditLog.recordSigning(data)
    },
    [],
  )

  const getEntries = useCallback(
    (filters?: Parameters<typeof transactionSigningAuditLog.getEntries>[0]) => {
      return transactionSigningAuditLog.getEntries(filters)
    },
    [],
  )

  return {
    entries,
    recordSigning,
    getEntries,
    verifyIntegrity: () => transactionSigningAuditLog.verifyIntegrity(),
    getStats: () => transactionSigningAuditLog.getStats(),
    exportAsJSON: (filters) => transactionSigningAuditLog.exportAsJSON(filters),
    exportAsCSV: (filters) => transactionSigningAuditLog.exportAsCSV(filters),
    clear: () => transactionSigningAuditLog.clear(),
    getEntryCount: () => transactionSigningAuditLog.getEntryCount(),
  }
}

export default useTransactionSigningAudit
