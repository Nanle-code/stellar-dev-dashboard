/**
 * Role-Based Access Control (RBAC) (#410)
 *
 * Defines role hierarchy, permissions, and access-check helpers.
 * All checks are pure functions — no side effects.
 */

// ─── Role Hierarchy ──────────────────────────────────────────────────────────

export const Role = {
  VIEWER: 'viewer',
  ANALYST: 'analyst',
  OPERATOR: 'operator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Numeric rank — higher = more privileged. */
const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  operator: 2,
  admin: 3,
  super_admin: 4,
};

// ─── Permissions ─────────────────────────────────────────────────────────────

export const Permission = {
  // Audit
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
  AUDIT_CLEAR: 'audit:clear',
  // Compliance
  COMPLIANCE_VIEW: 'compliance:view',
  COMPLIANCE_EXPORT: 'compliance:export',
  // Session recording
  SESSION_VIEW: 'session:view',
  SESSION_RECORD: 'session:record',
  SESSION_DELETE: 'session:delete',
  SESSION_REPLAY: 'session:replay',
  // RBAC management
  RBAC_VIEW: 'rbac:view',
  RBAC_ASSIGN: 'rbac:assign',
  // Transactions
  TX_VIEW: 'tx:view',
  TX_SIGN: 'tx:sign',
  TX_SUBMIT: 'tx:submit',
  // System
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_ADMIN: 'system:admin',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/** Permissions granted to each role (cumulative from lower roles). */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: [
    Permission.AUDIT_VIEW,
    Permission.TX_VIEW,
  ],
  analyst: [
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
    Permission.COMPLIANCE_VIEW,
    Permission.COMPLIANCE_EXPORT,
    Permission.SESSION_VIEW,
    Permission.SESSION_REPLAY,
    Permission.TX_VIEW,
    Permission.RBAC_VIEW,
  ],
  operator: [
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
    Permission.COMPLIANCE_VIEW,
    Permission.COMPLIANCE_EXPORT,
    Permission.SESSION_VIEW,
    Permission.SESSION_RECORD,
    Permission.SESSION_REPLAY,
    Permission.TX_VIEW,
    Permission.TX_SIGN,
    Permission.TX_SUBMIT,
    Permission.RBAC_VIEW,
  ],
  admin: [
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
    Permission.AUDIT_CLEAR,
    Permission.COMPLIANCE_VIEW,
    Permission.COMPLIANCE_EXPORT,
    Permission.SESSION_VIEW,
    Permission.SESSION_RECORD,
    Permission.SESSION_REPLAY,
    Permission.SESSION_DELETE,
    Permission.TX_VIEW,
    Permission.TX_SIGN,
    Permission.TX_SUBMIT,
    Permission.RBAC_VIEW,
    Permission.RBAC_ASSIGN,
    Permission.SYSTEM_CONFIG,
  ],
  super_admin: Object.values(Permission) as Permission[],
};

// ─── Role Assignment ──────────────────────────────────────────────────────────

export interface RoleAssignment {
  userId: string;
  role: Role;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  reason?: string;
}

// ─── Check helpers ────────────────────────────────────────────────────────────

/** Returns all permissions for a role. */
export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Returns true if the role has the given permission. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Returns true if roleA >= roleB in the hierarchy. */
export function roleAtLeast(roleA: Role, roleB: Role): boolean {
  return (ROLE_RANK[roleA] ?? -1) >= (ROLE_RANK[roleB] ?? 0);
}

/** Returns true if the role can perform the given action on a resource. */
export function canPerform(
  role: Role,
  permission: Permission,
  context?: { ownResource?: boolean },
): boolean {
  // Owners can always view their own resources even at viewer level
  if (context?.ownResource && permission === Permission.AUDIT_VIEW) return true;
  return hasPermission(role, permission);
}

/** Returns all roles ordered from highest to lowest. */
export function getRoleHierarchy(): Role[] {
  return (Object.keys(ROLE_RANK) as Role[]).sort(
    (a, b) => ROLE_RANK[b] - ROLE_RANK[a],
  );
}

// ─── Assignment storage (IndexedDB-backed via store) ─────────────────────────

const _assignments = new Map<string, RoleAssignment>();

export function setRoleAssignment(assignment: RoleAssignment): void {
  _assignments.set(assignment.userId, assignment);
}

export function getRoleAssignment(userId: string): RoleAssignment | null {
  return _assignments.get(userId) ?? null;
}

export function removeRoleAssignment(userId: string): void {
  _assignments.delete(userId);
}

export function getAllAssignments(): RoleAssignment[] {
  const now = new Date().toISOString();
  return Array.from(_assignments.values()).filter(
    (a) => !a.expiresAt || a.expiresAt > now,
  );
}

export function getUserRole(userId: string): Role {
  const now = new Date().toISOString();
  const a = _assignments.get(userId);
  if (!a) return Role.VIEWER;
  if (a.expiresAt && a.expiresAt <= now) return Role.VIEWER;
  return a.role;
}
