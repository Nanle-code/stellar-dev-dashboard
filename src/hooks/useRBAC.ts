/**
 * useRBAC - React hooks for permission checks (#410)
 */

import { useCallback, useMemo } from 'react';
import { useStore } from '../lib/store';
import {
  Permission, Role,
  getPermissions, hasPermission, roleAtLeast, canPerform,
  getRoleHierarchy, getAllAssignments,
  setRoleAssignment, removeRoleAssignment, getUserRole,
  type RoleAssignment,
} from '../lib/rbac';

/** Returns the current user's role (from store.currentUserId). */
export function useCurrentRole(): Role {
  const userId = useStore((s) => s.walletPublicKey);
  return useMemo(() => getUserRole(userId ?? ''), [userId]);
}

/** Returns true if the current user has the given permission. */
export function usePermission(permission: Permission): boolean {
  const role = useCurrentRole();
  return useMemo(() => hasPermission(role, permission), [role, permission]);
}

/** Returns a can() checker bound to the current user's role. */
export interface UseRBACContext {
  ownResource?: boolean;
}

export interface UseRBACReturn {
  role: Role;
  userId: string | null;
  can: (permission: Permission, context?: UseRBACContext) => boolean;
  is: (minRole: Role) => boolean;
  permissions: Permission[];
  hierarchy: Role[];
  assignments: RoleAssignment[];
  assign: (assignment: RoleAssignment) => void;
  revoke: (targetUserId: string) => void;
}

export function useRBAC(): UseRBACReturn {
  const role = useCurrentRole();
  const userId = useStore((s) => s.walletPublicKey);

  const can = useCallback(
    (permission: Permission, context?: UseRBACContext): boolean =>
      canPerform(role, permission, context),
    [role],
  );

  const is = useCallback(
    (minRole: Role): boolean => roleAtLeast(role, minRole),
    [role],
  );

  const permissions = useMemo(() => getPermissions(role), [role]);
  const hierarchy = useMemo(() => getRoleHierarchy(), []);

  const assignments = useMemo(() => getAllAssignments(), []);

  const assign = useCallback((assignment: RoleAssignment): void => {
    setRoleAssignment(assignment);
  }, []);

  const revoke = useCallback((targetUserId: string): void => {
    removeRoleAssignment(targetUserId);
  }, []);

  return { role, userId, can, is, permissions, hierarchy, assignments, assign, revoke };
}
