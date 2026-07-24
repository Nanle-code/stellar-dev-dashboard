/**
 * Audit data model types (#410)
 */

export type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'
  | 'debug' | 'warning' | 'error';

export type AuditCategory =
  | 'auth' | 'wallet' | 'transaction' | 'contract' | 'network'
  | 'config' | 'data_access' | 'export' | 'security' | 'admin'
  | 'system' | 'compliance' | 'retention' | 'analytics' | 'user';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export type AuditComplianceTag = 'soc2' | 'gdpr' | 'sox' | 'pci_dss' | 'internal';

/** Correlation ID for tracing a single user request across multiple audit events. */
export type CorrelationId = string;

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  actor: string | null;
  target: string | null;
  outcome: AuditOutcome;
  metadata: Record<string, unknown>;
  sessionId: string;
  correlationId?: CorrelationId;
  url?: string | null;
  userAgent?: string | null;
  complianceTags?: AuditComplianceTag[];
  environment?: string;
  source?: string;
  prevHash: string;
  hash: string;
}

export interface AuditFilter {
  category?: AuditCategory;
  severity?: AuditSeverity;
  actor?: string;
  search?: string;
  since?: string;
  until?: string;
  limit?: number;
  outcome?: AuditOutcome;
  sessionId?: string;
  complianceTag?: AuditComplianceTag;
  environment?: string;
  source?: string;
  correlationId?: CorrelationId;
}

export interface AuditStats {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byOutcome: Record<string, number>;
  byComplianceTag?: Record<string, number>;
}

export interface AuditChainVerification {
  valid: boolean;
  brokenAt: number;
  reason?: string;
}
