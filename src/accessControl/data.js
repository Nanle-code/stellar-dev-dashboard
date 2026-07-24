export const roleDefinitions = {
  admin: {
    permissions: ['read', 'write', 'delete', 'manage']
  },
  developer: {
    permissions: ['read', 'write']
  },
  viewer: {
    permissions: ['read']
  }
};

export function getAllRoles() {
  return Object.keys(roleDefinitions);
}

export function getPermissionsForRole(role) {
  return roleDefinitions[role]?.permissions || [];
}
