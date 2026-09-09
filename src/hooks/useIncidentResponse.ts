/**
 * React Hook for Incident Response (#593)
 *
 * Provides a comprehensive interface for incident classification,
 * automated response execution, and approval management in React components.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  type IncidentClassificationResult,
  type IncidentClassification,
  type IncidentEvidence,
  incidentClassifier,
} from '../lib/incidentClassifier'
import {
  type AutomationRunResult,
  type ResponseActionResult,
  type AutomationMetrics,
  incidentResponseAutomation,
} from '../lib/incidentResponseAutomation'
import {
  type ApprovalRequest,
  type ApprovalQueueState,
  approvalSystem,
} from '../lib/approvalSystem'
import { useStore } from '../lib/store'
import { useNotifications } from './useNotifications'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseIncidentResponseResult {
  // Classification
  classifyEvent: (
    eventType: string,
    evidence: IncidentEvidence[],
    options?: {
      burstCount?: number
      failureRate?: number
      anomalyScore?: number
    }
  ) => IncidentClassificationResult
  recentClassifications: IncidentClassification[]

  // Response automation
  executeResponse: (
    classificationResult: IncidentClassificationResult
  ) => Promise<AutomationRunResult>
  executeApprovedAction: (
    incidentId: string,
    action: string,
    classification: IncidentClassification
  ) => Promise<ResponseActionResult>
  recentRuns: AutomationRunResult[]
  automationMetrics: AutomationMetrics

  // Approval system
  pendingApprovals: ApprovalRequest[]
  approveRequest: (requestId: string) => void
  rejectRequest: (requestId: string, reason: string) => void
  approvalStats: ReturnType<typeof approvalSystem.getStats>

  // General
  isLoading: boolean
  error: string | null
  lastIncident: IncidentClassificationResult | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIncidentResponse(): UseIncidentResponseResult {
  const { connectedAddress } = useStore()
  const { success, error: showError } = useNotifications()

  const [recentClassifications, setRecentClassifications] = useState<
    IncidentClassification[]
  >([])
  const [recentRuns, setRecentRuns] = useState<AutomationRunResult[]>([])
  const [automationMetrics, setAutomationMetrics] = useState<AutomationMetrics>(
    incidentResponseAutomation.getMetrics()
  )
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [approvalState, setApprovalState] = useState<ApprovalQueueState>({
    pending: [],
    resolved: [],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastIncident, setLastIncident] =
    useState<IncidentClassificationResult | null>(null)

  // Subscribe to incident classifications
  useEffect(() => {
    const unsub = incidentClassifier.subscribe((result) => {
      setRecentClassifications(incidentClassifier.getRecent(50))
      setLastIncident(result)
    })

    return unsub
  }, [])

  // Subscribe to approval system changes
  useEffect(() => {
    const unsub = approvalSystem.subscribe((state) => {
      setApprovalState(state)
      setPendingApprovals(approvalSystem.getPending())
    })

    return unsub
  }, [])

  // Poll for metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setAutomationMetrics(incidentResponseAutomation.getMetrics())
      setRecentRuns(incidentResponseAutomation.getRecentRuns(20))
      setPendingApprovals(approvalSystem.getPending())
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // Classify an event
  const classifyEvent = useCallback(
    (
      eventType: string,
      evidence: IncidentEvidence[],
      options?: {
        burstCount?: number
        failureRate?: number
        anomalyScore?: number
      }
    ): IncidentClassificationResult => {
      try {
        const result = incidentClassifier.classify(eventType, evidence, options)
        setRecentClassifications(incidentClassifier.getRecent(50))
        setLastIncident(result)
        setError(null)
        return result
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Classification failed'
        setError(message)
        showError('Classification Error', message)
        throw err
      }
    },
    [showError]
  )

  // Execute automated response
  const executeResponse = useCallback(
    async (
      classificationResult: IncidentClassificationResult
    ): Promise<AutomationRunResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await incidentResponseAutomation.execute(
          classificationResult
        )

        if (result.pendingApproval.length > 0) {
          success(
            'Response Executed',
            `${result.actionResults.filter((r) => r.status === 'completed').length} actions completed, ${result.pendingApproval.length} awaiting approval.`
          )
        } else {
          success(
            'Response Executed',
            `All ${result.actionResults.length} actions completed successfully.`
          )
        }

        setRecentRuns(incidentResponseAutomation.getRecentRuns(20))
        setAutomationMetrics(incidentResponseAutomation.getMetrics())
        return result
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Response execution failed'
        setError(message)
        showError('Automation Error', message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [success, showError]
  )

  // Execute approved action
  const executeApprovedAction = useCallback(
    async (
      incidentId: string,
      action: string,
      classification: IncidentClassification
    ): Promise<ResponseActionResult> => {
      try {
        const result = await incidentResponseAutomation.executeApprovedAction(
          incidentId,
          action,
          classification
        )

        if (result.status === 'completed') {
          success('Action Executed', `${action} completed successfully.`)
        }

        return result
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Action execution failed'
        showError('Action Error', message)
        throw err
      }
    },
    [success, showError]
  )

  // Approve a pending request
  const handleApprove = useCallback(
    (requestId: string) => {
      try {
        const approved = approvalSystem.approve(
          requestId,
          connectedAddress || 'operator'
        )
        if (approved) {
          success('Approval Granted', `${approved.action} has been approved.`)
        }
        setPendingApprovals(approvalSystem.getPending())
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Approval failed'
        showError('Approval Error', message)
      }
    },
    [connectedAddress, success, showError]
  )

  // Reject a pending request
  const handleReject = useCallback(
    (requestId: string, reason: string) => {
      try {
        const rejected = approvalSystem.reject(
          requestId,
          connectedAddress || 'operator',
          reason
        )
        if (rejected) {
          success('Approval Rejected', `${rejected.action} has been rejected.`)
        }
        setPendingApprovals(approvalSystem.getPending())
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Rejection failed'
        showError('Approval Error', message)
      }
    },
    [connectedAddress, success, showError]
  )

  const approvalStats = useMemo(() => approvalSystem.getStats(), [approvalState])

  return {
    classifyEvent,
    recentClassifications,
    executeResponse,
    executeApprovedAction,
    recentRuns,
    automationMetrics,
    pendingApprovals,
    approveRequest: handleApprove,
    rejectRequest: handleReject,
    approvalStats,
    isLoading,
    error,
    lastIncident,
  }
}

export default useIncidentResponse
