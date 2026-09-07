import React from "react";
import { getEnvironmentConfig, loadConfigProfiles, getActiveProfileName } from "../lib/config";
import { useStore } from "../lib/store";
import {
  loadInstalledPlugins,
  upsertInstalledPlugin,
  removeInstalledPlugin,
  loadPermissionGrants,
  savePermissionGrants,
} from "./pluginStorage";
import { fetchMarketplacePlugins, fetchMarketplacePluginById } from "./pluginCatalog";
import SandboxedPluginFrame from "./pluginSandbox";

const PLUGIN_STATUSES = Object.freeze({
  REGISTERED: "registered",
  INITIALIZED: "initialized",
  FAILED: "failed",
  BLOCKED: "blocked",
  PENDING_REVIEW: "pending-review",
  DISABLED: "disabled",
});

const ALLOWED_PERMISSION_SCOPES = Object.freeze([
  "dashboard:read",
  "dashboard:write",
  "data:read",
  "data:write",
  "notifications:write",
  "network:request",
  "storage:read",
  "storage:write",
  "window:open",
]);

const SAFE_STATE_KEYS = Object.freeze([
  "network",
  "theme",
  "activeTab",
  "connectedAddress",
  "accountData",
  "transactions",
  "operations",
  "networkStats",
  "prices",
  "walletConnected",
  "walletType",
  "walletPublicKey",
  "streamStatus",
  "streamLedgers",
  "searchFilters",
  "notificationHistory",
  "unreadNotificationCount",
]);

const SAFE_ACTION_KEYS = Object.freeze([
  "setActiveTab",
  "setNetwork",
  "setConnectedAddress",
  "setSearchFilters",
  "addNotification",
  "removeNotification",
]);

const pluginModules = import.meta.glob("./**/*Plugin.{js,jsx,ts,tsx}", {
  eager: false,
});

let registrationPromise = null;
let registrationComplete = false;

function freezePlainObject(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freezePlainObject));

  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, freezePlainObject(entry)])
    )
  );
}

function pickSafeState(state) {
  return freezePlainObject(
    SAFE_STATE_KEYS.reduce((slice, key) => {
      if (state[key] !== undefined) slice[key] = state[key];
      return slice;
    }, {})
  );
}

function normalizePlugin(rawPlugin) {
  const plugin = rawPlugin?.default || rawPlugin?.plugin || rawPlugin?.createPlugin || rawPlugin;
  if (typeof plugin === "function") return plugin();
  return plugin;
}

function normalizeManifest(plugin) {
  if (!plugin || typeof plugin !== "object") return null;
  const manifest = plugin.manifest || plugin;

  if (!manifest.id || typeof manifest.id !== "string") return null;
  if (!manifest.name || typeof manifest.name !== "string") return null;

  const permissions = Array.isArray(manifest.permissions)
    ? manifest.permissions.filter(
        (permission) =>
          typeof permission === "string" && ALLOWED_PERMISSION_SCOPES.includes(permission)
      )
    : [];

  const dependencyPlugins = Array.isArray(manifest.dependencies?.plugins)
    ? manifest.dependencies.plugins.filter((pluginId) => typeof pluginId === "string")
    : [];

  return freezePlainObject({
    id: manifest.id,
    name: manifest.name,
    version: String(manifest.version || "1.0.0"),
    description: String(manifest.description || ""),
    author: manifest.author || null,
    homepageUrl: manifest.homepageUrl || null,
    permissions,
    dependencies: { plugins: dependencyPlugins },
    runtime: {
      mode: manifest.runtime?.mode || "module",
      entry: manifest.runtime?.entry || null,
      source: manifest.runtime?.source || null,
      srcDoc: manifest.runtime?.srcDoc || null,
      sandbox: Array.isArray(manifest.runtime?.sandbox)
        ? manifest.runtime.sandbox.filter(Boolean)
        : ["allow-scripts"],
    },
    widgets: Array.isArray(manifest.widgets) ? manifest.widgets : [],
    dataSources: Array.isArray(manifest.dataSources) ? manifest.dataSources : [],
  });
}

function compareVersions(a, b) {
  const parse = (value) =>
    String(value || "0.0.0")
      .split(".")
      .map((segment) => Number.parseInt(segment, 10) || 0);

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function sanitizePermissions(permissions = []) {
  return Array.from(
    new Set(
      (Array.isArray(permissions) ? permissions : []).filter((permission) =>
        ALLOWED_PERMISSION_SCOPES.includes(permission)
      )
    )
  );
}

function hasPermission(record, permission) {
  return Array.isArray(record.permissionsGranted) && record.permissionsGranted.includes(permission);
}

function createFailureWidget(pluginId, name, message) {
  return {
    id: `${pluginId}:failure`,
    title: `${name} unavailable`,
    placement: "settings",
    order: 999,
    component: function PluginFailureWidget() {
      return React.createElement(
        "div",
        {
          style: {
            color: "var(--red)",
            fontSize: "12px",
            lineHeight: 1.5,
          },
        },
        message
      );
    },
  };
}

function createIframeRuntime(manifest) {
  return {
    initialize: async () => undefined,
    getWidgets: () => manifest.widgets || [],
    getDataSources: () => manifest.dataSources || [],
  };
}

function createModuleRuntimeLoader(manifest) {
  if (!manifest.runtime?.entry) return null;

  return async () => {
    const imported = await import(/* @vite-ignore */ manifest.runtime.entry);
    const runtime = normalizePlugin(imported);
    if (typeof runtime === "function") {
      return runtime();
    }
    return runtime || {};
  };
}

function createRecord({
  manifest,
  runtime,
  runtimeLoader,
  sourceType,
  permissionsGranted,
  enabled = true,
  installedAt = null,
  initializedAt = null,
  status = PLUGIN_STATUSES.REGISTERED,
  error = null,
  runtimeLoaded = true,
}) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    manifest,
    runtime,
    runtimeLoader,
    runtimeLoaded,
    sourceType,
    status,
    error,
    enabled,
    installedAt,
    initializedAt,
    permissionsGranted: sanitizePermissions(permissionsGranted || manifest.permissions || []),
    updateAvailable: false,
    latestVersion: null,
    dependencyStatus: null,
  };
}

export class PluginManager {
  constructor({ store = useStore } = {}) {
    this.store = store && typeof store.getState === "function" ? store : useStore;
    this.plugins = new Map();
    this.listeners = new Set();
    this.initializing = null;
    this.marketplace = new Map();
    this.hydrated = false;
  }

  createDashboardApi(pluginId, manifest) {
    const currentState = this.store.getState();
    const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];

    const actions = {};
    if (permissions.includes("dashboard:write")) {
      SAFE_ACTION_KEYS.forEach((key) => {
        const action = currentState[key];
        if (typeof action === "function") {
          actions[key] = (...args) => action(...args);
        }
      });
    }

    if (permissions.includes("notifications:write")) {
      const addNotification = currentState.addNotification;
      const removeNotification = currentState.removeNotification;
      if (typeof addNotification === "function") {
        actions.addNotification = (...args) => addNotification(...args);
      }
      if (typeof removeNotification === "function") {
        actions.removeNotification = (...args) => removeNotification(...args);
      }
    }

    return Object.freeze({
      pluginId,
      manifest,
      permissions: Object.freeze([...permissions]),
      version: "1.0.0",
      getState: () => pickSafeState(this.store.getState()),
      getConfig: () =>
        freezePlainObject({
          environment: getEnvironmentConfig(),
          activeProfileName: getActiveProfileName(),
          profiles: loadConfigProfiles(),
        }),
      actions: Object.freeze(actions),
      subscribe: (listener) => {
        if (typeof listener !== "function" || !permissions.includes("dashboard:read")) {
          return () => {};
        }
        return this.store.subscribe((state) => listener(pickSafeState(state)));
      },
      logger: Object.freeze({
        info: (...args) => console.info(`[plugin:${pluginId}]`, ...args),
        warn: (...args) => console.warn(`[plugin:${pluginId}]`, ...args),
        error: (...args) => console.error(`[plugin:${pluginId}]`, ...args),
      }),
    });
  }

  emitChange() {
    this.listeners.forEach((listener) => listener(this));
  }

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  validate(plugin) {
    if (!plugin || typeof plugin !== "object") {
      return "Plugin export must be an object or factory.";
    }

    const manifest = normalizeManifest(plugin);
    if (!manifest) return "Plugin manifest is invalid or incomplete.";
    if (plugin.initialize && typeof plugin.initialize !== "function") {
      return "Plugin initialize hook must be a function.";
    }
    if (plugin.getWidgets && typeof plugin.getWidgets !== "function") {
      return "Plugin getWidgets hook must be a function.";
    }
    if (plugin.getDataSources && typeof plugin.getDataSources !== "function") {
      return "Plugin getDataSources hook must be a function.";
    }

    return null;
  }

  getRecord(pluginId) {
    return this.plugins.get(pluginId) || null;
  }

  getMarketplaceCache() {
    return Array.from(this.marketplace.values());
  }

  async hydrateInstalledPlugins() {
    if (this.hydrated) return;
    this.hydrated = true;

    const installed = loadInstalledPlugins();
    for (const installedRecord of installed) {
      if (!installedRecord || typeof installedRecord !== "object") continue;
      const manifest = normalizeManifest(installedRecord.manifest);
      if (!manifest) continue;

      if (this.plugins.has(manifest.id)) {
        continue;
      }

      const runtime =
        manifest.runtime.mode === "iframe"
          ? createIframeRuntime(manifest)
          : {
              initialize: async () => undefined,
              getWidgets: () => manifest.widgets || [],
              getDataSources: () => manifest.dataSources || [],
            };

      const runtimeLoader =
        manifest.runtime.mode === "module" ? createModuleRuntimeLoader(manifest) : null;

      const record = createRecord({
        manifest,
        runtime,
        runtimeLoader,
        sourceType: installedRecord.sourceType || "installed",
        permissionsGranted: installedRecord.permissionsGranted || manifest.permissions || [],
        enabled: installedRecord.enabled !== false,
        installedAt: installedRecord.installedAt || new Date().toISOString(),
        initializedAt: installedRecord.initializedAt || null,
        status: installedRecord.enabled === false ? PLUGIN_STATUSES.DISABLED : PLUGIN_STATUSES.REGISTERED,
        error: installedRecord.error || null,
        runtimeLoaded: manifest.runtime.mode !== "module" || !runtimeLoader,
      });

      this.plugins.set(record.id, record);
    }
  }

  persistRecord(record) {
    if (record.sourceType === "builtin") return;

    upsertInstalledPlugin({
      id: record.id,
      name: record.name,
      version: record.version,
      manifest: record.manifest,
      permissionsGranted: record.permissionsGranted,
      enabled: record.enabled,
      installedAt: record.installedAt,
      initializedAt: record.initializedAt,
      error: record.error,
      sourceType: record.sourceType,
    });

    const grants = loadPermissionGrants();
    savePermissionGrants({
      ...grants,
      [record.id]: record.permissionsGranted,
    });
  }

  removePersistedRecord(pluginId) {
    removeInstalledPlugin(pluginId);
    const grants = loadPermissionGrants();
    if (grants && Object.prototype.hasOwnProperty.call(grants, pluginId)) {
      const next = { ...grants };
      delete next[pluginId];
      savePermissionGrants(next);
    }
  }

  register(rawPlugin, options = {}) {
    const plugin = normalizePlugin(rawPlugin);
    const validationError = this.validate(plugin);
    const safePlugin = validationError
      ? {
          id: String(plugin?.id || `invalid-plugin-${Date.now()}`),
          name: String(plugin?.name || plugin?.id || "Invalid plugin"),
          version: "0.0.0",
          permissions: [],
          runtime: { mode: "iframe" },
          widgets: [
            createFailureWidget(
              String(plugin?.id || "invalid"),
              String(plugin?.name || "Invalid"),
              validationError
            ),
          ],
          dataSources: [],
          initialize: async () => undefined,
          getWidgets: () => [
            createFailureWidget(
              String(plugin?.id || "invalid"),
              String(plugin?.name || "Invalid"),
              validationError
            ),
          ],
          getDataSources: () => [],
        }
      : plugin;

    const manifest = normalizeManifest(safePlugin);
    if (!manifest) {
      throw new Error("Plugin manifest is invalid.");
    }

    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin ID conflict: "${manifest.id}" is already registered.`);
    }

    const runtime =
      options.runtime ||
      safePlugin ||
      (manifest.runtime.mode === "iframe" ? createIframeRuntime(manifest) : null);

    const runtimeLoader =
      options.runtimeLoader ||
      (manifest.runtime.mode === "module" ? createModuleRuntimeLoader(manifest) : null);

    const record = createRecord({
      manifest,
      runtime,
      runtimeLoader,
      sourceType: options.sourceType || "builtin",
      permissionsGranted: options.permissionsGranted || manifest.permissions || [],
      enabled: options.enabled !== false,
      installedAt: options.installedAt || null,
      initializedAt: options.initializedAt || null,
      status: options.enabled === false ? PLUGIN_STATUSES.DISABLED : PLUGIN_STATUSES.REGISTERED,
      error: validationError || options.error || null,
      runtimeLoaded: options.runtimeLoaded !== undefined ? options.runtimeLoaded : manifest.runtime.mode !== "module" || !runtimeLoader,
    });

    this.plugins.set(record.id, record);
    this.emitChange();
    return record;
  }

  canActivate(record) {
    if (!record.enabled) {
      return { ok: false, reason: "Plugin is disabled." };
    }

    const missingDependencies = (record.manifest.dependencies?.plugins || []).filter(
      (dependencyId) => !this.plugins.has(dependencyId)
    );
    if (missingDependencies.length > 0) {
      return {
        ok: false,
        reason: `Missing plugin dependencies: ${missingDependencies.join(", ")}`,
      };
    }

    const missingPermissions = (record.manifest.permissions || []).filter(
      (permission) => !hasPermission(record, permission)
    );
    if (missingPermissions.length > 0) {
      return {
        ok: false,
        reason: `Missing permissions: ${missingPermissions.join(", ")}`,
      };
    }

    return { ok: true };
  }

  async initializeAll() {
    if (this.initializing) return this.initializing;

    this.initializing = Promise.all(
      Array.from(this.plugins.values()).map(async (record) => {
        const activation = this.canActivate(record);
        if (!activation.ok) {
          record.status = record.enabled ? PLUGIN_STATUSES.BLOCKED : PLUGIN_STATUSES.DISABLED;
          record.error = activation.reason;
          return record;
        }

        if (record.status === PLUGIN_STATUSES.INITIALIZED && record.runtimeLoaded) {
          return record;
        }

        try {
          if (record.runtimeLoader && !record.runtimeLoaded) {
            record.status = PLUGIN_STATUSES.REGISTERED;
            record.runtime = await record.runtimeLoader();
            record.runtimeLoaded = true;
          }

          const api = this.createDashboardApi(record.id, record.manifest);
          if (typeof record.runtime?.initialize === "function") {
            await record.runtime.initialize(api);
          }

          record.status = PLUGIN_STATUSES.INITIALIZED;
          record.initializedAt = new Date().toISOString();
          record.error = null;
          this.persistRecord(record);
        } catch (error) {
          record.status = PLUGIN_STATUSES.FAILED;
          record.error = error?.message || String(error);
        }

        return record;
      })
    ).finally(() => {
      this.initializing = null;
      this.refreshMarketplaceSnapshot().catch(() => {});
      this.emitChange();
    });

    return this.initializing;
  }

  async refreshMarketplaceSnapshot() {
    const catalog = await fetchMarketplacePlugins();
    this.marketplace = new Map(catalog.map((plugin) => [plugin.id, plugin]));

    for (const record of this.plugins.values()) {
      const marketplacePlugin = this.marketplace.get(record.id);
      record.latestVersion = marketplacePlugin?.version || record.version;
      record.updateAvailable =
        !!marketplacePlugin && compareVersions(marketplacePlugin.version, record.version) > 0;
    }

    this.emitChange();
    return this.getMarketplacePlugins();
  }

  async getMarketplacePlugins() {
    if (this.marketplace.size === 0) {
      await this.refreshMarketplaceSnapshot();
    }

    return Array.from(this.marketplace.values()).map((plugin) => {
      const installed = this.plugins.get(plugin.id);
      const updateAvailable = installed
        ? compareVersions(plugin.version, installed.version) > 0
        : false;

      return {
        ...plugin,
        installed: Boolean(installed),
        installedVersion: installed?.version || null,
        updateAvailable,
      };
    });
  }

  getPluginRecords() {
    return Array.from(this.plugins.values()).map((record) => ({
      id: record.id,
      name: record.name,
      status: record.status,
      error: record.error,
      initializedAt: record.initializedAt,
      version: record.version,
      latestVersion: record.latestVersion || record.version,
      updateAvailable: Boolean(record.updateAvailable),
      sourceType: record.sourceType,
      enabled: record.enabled,
      permissionsGranted: record.permissionsGranted,
      permissionsRequested: record.manifest.permissions || [],
      dependencies: record.manifest.dependencies?.plugins || [],
      installedAt: record.installedAt,
    }));
  }

  getWidgets({ placement } = {}) {
    return Array.from(this.plugins.values())
      .flatMap((record) => {
        if (record.status === PLUGIN_STATUSES.FAILED || record.status === PLUGIN_STATUSES.DISABLED) {
          return [];
        }

        try {
          const widgets =
            typeof record.runtime?.getWidgets === "function"
              ? record.runtime.getWidgets()
              : record.manifest.widgets || [];
          return widgets
            .map((widget, index) => this.normalizeWidget(widget, record, index))
            .filter(Boolean);
        } catch (error) {
          record.error = error?.message || String(error);
          record.status = PLUGIN_STATUSES.FAILED;
          return [];
        }
      })
      .filter((widget) => !placement || widget.placement === placement)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  normalizeWidget(widget, record, index) {
    if (!widget || typeof widget !== "object") return null;

    const Component = widget.component || widget.Component || widget.render;
    const isIframeWidget = widget.kind === "iframe" || (!Component && record.manifest.runtime.mode === "iframe");

    if (!Component && !isIframeWidget) {
      return null;
    }

    return {
      id: String(widget.id || `${record.id}:widget:${index}`),
      pluginId: record.id,
      pluginName: record.name,
      title: widget.title || widget.name || record.name,
      placement: widget.placement || "settings",
      order: Number.isFinite(widget.order) ? widget.order : 100,
      props: widget.props || {},
      component: isIframeWidget
        ? (iframeProps) =>
            React.createElement(SandboxedPluginFrame, {
              title: widget.title || widget.name || record.name,
              description: widget.description || record.manifest.description,
              src: widget.src || record.manifest.runtime.entry || undefined,
              srcDoc: widget.srcDoc || record.manifest.runtime.srcDoc || undefined,
              sandbox: widget.sandbox || record.manifest.runtime.sandbox,
              height: widget.height || 220,
              ...iframeProps,
            })
        : Component,
    };
  }

  getDataSources() {
    return Array.from(this.plugins.values()).flatMap((record) => {
      if (record.status === PLUGIN_STATUSES.FAILED || record.status === PLUGIN_STATUSES.DISABLED) {
        return [];
      }

      try {
        const dataSources =
          typeof record.runtime?.getDataSources === "function"
            ? record.runtime.getDataSources()
            : record.manifest.dataSources || [];
        return dataSources
          .map((dataSource, index) => this.normalizeDataSource(dataSource, record, index))
          .filter(Boolean);
      } catch (error) {
        record.error = error?.message || String(error);
        record.status = PLUGIN_STATUSES.FAILED;
        return [];
      }
    });
  }

  normalizeDataSource(dataSource, record, index) {
    if (!dataSource || typeof dataSource !== "object") return null;
    return {
      id: String(dataSource.id || `${record.id}:data-source:${index}`),
      pluginId: record.id,
      pluginName: record.name,
      name: dataSource.name || dataSource.id || `Data source ${index + 1}`,
      description: dataSource.description || "",
      fetch: typeof dataSource.fetch === "function" ? dataSource.fetch : null,
      subscribe: typeof dataSource.subscribe === "function" ? dataSource.subscribe : null,
      metadata: dataSource.metadata || {},
    };
  }

  async installPlugin(manifest, { approvedPermissions } = {}) {
    const normalizedManifest = normalizeManifest(manifest);
    if (!normalizedManifest) {
      throw new Error("Cannot install an invalid plugin manifest.");
    }

    const existing = this.plugins.get(normalizedManifest.id);
    if (existing?.sourceType === "builtin") {
      throw new Error(`"${normalizedManifest.id}" is reserved by a built-in plugin.`);
    }
    if (existing?.sourceType === "installed") {
      await this.uninstallPlugin(normalizedManifest.id);
    }

    const requested = sanitizePermissions(normalizedManifest.permissions || []);
    const granted = sanitizePermissions(approvedPermissions || requested);

    if (requested.some((permission) => !granted.includes(permission))) {
      throw new Error("Permission review required before installing this plugin.");
    }

    const runtime =
      normalizedManifest.runtime.mode === "iframe"
        ? createIframeRuntime(normalizedManifest)
        : null;
    const runtimeLoader =
      normalizedManifest.runtime.mode === "module"
        ? createModuleRuntimeLoader(normalizedManifest)
        : null;

    const record = createRecord({
      manifest: normalizedManifest,
      runtime,
      runtimeLoader,
      sourceType: "installed",
      permissionsGranted: granted,
      enabled: true,
      installedAt: new Date().toISOString(),
      status: PLUGIN_STATUSES.REGISTERED,
      runtimeLoaded: normalizedManifest.runtime.mode !== "module" || !runtimeLoader,
    });

    this.plugins.set(record.id, record);
    this.persistRecord(record);
    await this.initializeAll();
    return record;
  }

  async updatePlugin(pluginId) {
    const current = this.plugins.get(pluginId);
    if (!current) {
      throw new Error(`Plugin "${pluginId}" is not installed.`);
    }

    const marketplacePlugin = await fetchMarketplacePluginById(pluginId);
    if (!marketplacePlugin) {
      throw new Error(`No marketplace update was found for "${pluginId}".`);
    }

    const currentPermissions = current.permissionsGranted || [];
    const requested = sanitizePermissions(marketplacePlugin.permissions || []);
    const missingPermissions = requested.filter((permission) => !currentPermissions.includes(permission));
    if (missingPermissions.length > 0) {
      throw new Error(
        `Plugin update requires additional permissions: ${missingPermissions.join(", ")}`
      );
    }

    return this.installPlugin(marketplacePlugin, { approvedPermissions: currentPermissions });
  }

  async uninstallPlugin(pluginId) {
    this.plugins.delete(pluginId);
    this.removePersistedRecord(pluginId);
    this.emitChange();
  }

  async setPluginEnabled(pluginId, enabled) {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw new Error(`Plugin "${pluginId}" is not installed.`);
    }

    record.enabled = Boolean(enabled);
    record.status = record.enabled ? PLUGIN_STATUSES.REGISTERED : PLUGIN_STATUSES.DISABLED;
    record.error = null;
    this.persistRecord(record);
    await this.initializeAll();
    return record;
  }

  async bootstrap() {
    await this.hydrateInstalledPlugins();
    await this.refreshMarketplaceSnapshot();
    return this;
  }
}

export const pluginManager = new PluginManager();

export async function registerActivePlugins(manager = pluginManager) {
  if (registrationComplete) return manager;
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    await manager.hydrateInstalledPlugins();

    await Promise.all(
      Object.entries(pluginModules).map(async ([path, loadModule]) => {
        try {
          const module = await loadModule();
          const pluginFactory = normalizePlugin(module);
          if (!pluginFactory) {
            manager.register(
              {
                id: path.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
                name: path,
                version: "0.0.0",
                runtime: { mode: "iframe" },
                widgets: [],
                dataSources: [],
              },
              { sourceType: "builtin" }
            );
            return;
          }

          manager.register(pluginFactory, { sourceType: "builtin" });
        } catch (error) {
          const id = path.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
          manager.register(
            {
              id,
              name: path,
              version: "0.0.0",
              runtime: { mode: "iframe" },
              widgets: [
                createFailureWidget(id, path, error?.message || String(error)),
              ],
              dataSources: [],
              initialize: async () => {
                throw error;
              },
            },
            { sourceType: "builtin", error: error?.message || String(error) }
          );
        }
      })
    );

    await manager.bootstrap();
    await manager.initializeAll();
    registrationComplete = true;
    return manager;
  })().finally(() => {
    registrationPromise = null;
  });

  return registrationPromise;
}

export { PLUGIN_STATUSES };
