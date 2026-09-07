const STORAGE_KEY = "stellar-dashboard:plugins:v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readState() {
  if (!isBrowser()) {
    return { installed: [], permissionGrants: {}, metadata: {} };
  }

  const parsed = readJson(localStorage.getItem(STORAGE_KEY));
  if (!parsed || typeof parsed !== "object") {
    return { installed: [], permissionGrants: {}, metadata: {} };
  }

  return {
    installed: Array.isArray(parsed.installed) ? parsed.installed : [],
    permissionGrants:
      parsed.permissionGrants && typeof parsed.permissionGrants === "object"
        ? parsed.permissionGrants
        : {},
    metadata: parsed.metadata && typeof parsed.metadata === "object" ? parsed.metadata : {},
  };
}

function writeState(nextState) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Storage can fail in private mode or quota-limited environments.
  }
}

export function loadPluginStorage() {
  return readState();
}

export function savePluginStorage(nextState) {
  writeState({
    installed: Array.isArray(nextState?.installed) ? nextState.installed : [],
    permissionGrants:
      nextState?.permissionGrants && typeof nextState.permissionGrants === "object"
        ? nextState.permissionGrants
        : {},
    metadata:
      nextState?.metadata && typeof nextState.metadata === "object" ? nextState.metadata : {},
  });
}

export function loadInstalledPlugins() {
  return readState().installed;
}

export function saveInstalledPlugins(installed) {
  const current = readState();
  writeState({
    ...current,
    installed: Array.isArray(installed) ? installed : [],
  });
}

export function loadPermissionGrants() {
  return readState().permissionGrants;
}

export function savePermissionGrants(permissionGrants) {
  const current = readState();
  writeState({
    ...current,
    permissionGrants:
      permissionGrants && typeof permissionGrants === "object" ? permissionGrants : {},
  });
}

export function upsertInstalledPlugin(record) {
  const current = readState();
  const installed = current.installed.filter((item) => item.id !== record.id);
  installed.unshift(record);
  writeState({
    ...current,
    installed,
  });
  return installed;
}

export function removeInstalledPlugin(pluginId) {
  const current = readState();
  const installed = current.installed.filter((item) => item.id !== pluginId);
  const permissionGrants = { ...current.permissionGrants };
  delete permissionGrants[pluginId];
  writeState({
    ...current,
    installed,
    permissionGrants,
  });
  return installed;
}

export function setPluginMetadata(pluginId, metadata) {
  const current = readState();
  writeState({
    ...current,
    metadata: {
      ...current.metadata,
      [pluginId]: {
        ...(current.metadata[pluginId] || {}),
        ...(metadata && typeof metadata === "object" ? metadata : {}),
      },
    },
  });
}

export function getPluginMetadata(pluginId) {
  const current = readState();
  return current.metadata[pluginId] || null;
}
