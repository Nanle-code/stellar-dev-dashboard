import { getEnvironmentConfig, loadConfigProfiles, getActiveProfileName } from "../lib/config";
import {
  getPluginIsolatedStorage,
  setPluginIsolatedItem,
  getPluginIsolatedItem,
  removePluginIsolatedItem,
  clearPluginIsolatedStorage,
} from "./pluginStorage";

export const CAPABILITY_SCOPES = Object.freeze([
  "dashboard:read",
  "dashboard:write",
  "data:read",
  "data:write",
  "notifications:write",
  "network:request",
  "storage:read",
  "storage:write",
  "window:open",
] as const);

export type CapabilityScope = (typeof CAPABILITY_SCOPES)[number];

export const CAPABILITY_ERROR_CODES = Object.freeze({
  NOT_GRANTED: "ERR_CAPABILITY_NOT_GRANTED",
  REVOKED: "ERR_CAPABILITY_REVOKED",
  INVALID_SCOPE: "ERR_INVALID_CAPABILITY_SCOPE",
  INVALID_INPUT: "ERR_INVALID_INPUT",
  UNSUPPORTED_ENVIRONMENT: "ERR_UNSUPPORTED_ENVIRONMENT",
  EXECUTION_FAILED: "ERR_CAPABILITY_EXECUTION_FAILED",
} as const);

export type CapabilityErrorCode = (typeof CAPABILITY_ERROR_CODES)[keyof typeof CAPABILITY_ERROR_CODES];

export class CapabilityError extends Error {
  readonly code: string;
  readonly capability?: string;
  readonly pluginId?: string;

  constructor(
    message: string,
    options: { code: string; capability?: string; pluginId?: string }
  ) {
    super(message);
    this.name = "CapabilityError";
    this.code = options.code;
    this.capability = options.capability;
    this.pluginId = options.pluginId;
    Object.setPrototypeOf(this, CapabilityError.prototype);
  }
}

export function isCapabilityScope(value: unknown): value is CapabilityScope {
  return typeof value === "string" && (CAPABILITY_SCOPES as readonly string[]).includes(value);
}

export function validateCapabilityScope(capability: unknown, pluginId?: string): asserts capability is CapabilityScope {
  if (!isCapabilityScope(capability)) {
    throw new CapabilityError(
      `Invalid capability scope: "${String(capability)}". Allowed scopes are: ${CAPABILITY_SCOPES.join(", ")}`,
      {
        code: CAPABILITY_ERROR_CODES.INVALID_SCOPE,
        capability: typeof capability === "string" ? capability : undefined,
        pluginId,
      }
    );
  }
}

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
]);

function freezePlainObject<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freezePlainObject)) as unknown as T;

  return Object.freeze(
    Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        freezePlainObject(entry),
      ])
    )
  ) as T;
}

export function pickSafeState(state: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!state || typeof state !== "object") return Object.freeze({});
  return freezePlainObject(
    SAFE_STATE_KEYS.reduce<Record<string, unknown>>((slice, key) => {
      if (state[key] !== undefined) slice[key] = state[key];
      return slice;
    }, {})
  );
}

function sanitizeUrl(rawUrl: unknown, pluginId?: string): URL {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new CapabilityError("URL must be a non-empty string.", {
      code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
      pluginId,
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl, typeof window !== "undefined" && window.location ? window.location.href : "https://localhost");
  } catch {
    throw new CapabilityError(`Invalid URL provided: "${rawUrl}".`, {
      code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
      pluginId,
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CapabilityError(
      `Protocol "${parsed.protocol}" is not allowed for sandbox network requests. Only HTTP and HTTPS are permitted.`,
      {
        code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
        capability: "network:request",
        pluginId,
      }
    );
  }

  return parsed;
}

export class PluginCapabilityController {
  readonly pluginId: string;
  private readonly grantedCapabilities: Set<CapabilityScope>;
  private readonly revokedCapabilities: Set<CapabilityScope>;
  private readonly activeCleanups: Map<string, Set<() => void>>;
  private readonly changeListeners: Set<(_controller: PluginCapabilityController) => void>;

  constructor(pluginId: string, initialCapabilities: readonly string[] = []) {
    if (!pluginId || typeof pluginId !== "string") {
      throw new CapabilityError("Plugin ID must be a non-empty string.", {
        code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
      });
    }

    this.pluginId = pluginId;
    this.grantedCapabilities = new Set<CapabilityScope>();
    this.revokedCapabilities = new Set<CapabilityScope>();
    this.activeCleanups = new Map<string, Set<() => void>>();
    this.changeListeners = new Set<(_controller: PluginCapabilityController) => void>();

    initialCapabilities.forEach((cap) => {
      if (isCapabilityScope(cap)) {
        this.grantedCapabilities.add(cap);
      }
    });
  }

  assertCapability(capability: unknown): asserts capability is CapabilityScope {
    validateCapabilityScope(capability, this.pluginId);

    if (this.revokedCapabilities.has(capability)) {
      throw new CapabilityError(
        `Capability "${capability}" has been revoked for plugin "${this.pluginId}".`,
        {
          code: CAPABILITY_ERROR_CODES.REVOKED,
          capability,
          pluginId: this.pluginId,
        }
      );
    }

    if (!this.grantedCapabilities.has(capability)) {
      throw new CapabilityError(
        `Plugin "${this.pluginId}" does not possess explicitly granted capability "${capability}".`,
        {
          code: CAPABILITY_ERROR_CODES.NOT_GRANTED,
          capability,
          pluginId: this.pluginId,
        }
      );
    }
  }

  hasCapability(capability: unknown): boolean {
    if (!isCapabilityScope(capability)) return false;
    return this.grantedCapabilities.has(capability) && !this.revokedCapabilities.has(capability);
  }

  grant(capability: unknown): void {
    validateCapabilityScope(capability, this.pluginId);
    this.revokedCapabilities.delete(capability);
    this.grantedCapabilities.add(capability);
    this.notifyChange();
  }

  revoke(capability: unknown): void {
    validateCapabilityScope(capability, this.pluginId);
    this.grantedCapabilities.delete(capability);
    this.revokedCapabilities.add(capability);

    // Safely trigger cleanups registered for this capability
    const cleanups = this.activeCleanups.get(capability);
    if (cleanups) {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Prevent individual cleanup failure from aborting revocation
        }
      });
      cleanups.clear();
      this.activeCleanups.delete(capability);
    }

    this.notifyChange();
  }

  revokeAll(): void {
    const allCapabilities = Array.from(this.grantedCapabilities);
    allCapabilities.forEach((cap) => {
      this.revokedCapabilities.add(cap);
    });
    this.grantedCapabilities.clear();

    this.activeCleanups.forEach((cleanups) => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Safe disposal
        }
      });
      cleanups.clear();
    });
    this.activeCleanups.clear();

    this.notifyChange();
  }

  getGrantedCapabilities(): CapabilityScope[] {
    return Array.from(this.grantedCapabilities).filter(
      (cap) => !this.revokedCapabilities.has(cap)
    );
  }

  getRevokedCapabilities(): CapabilityScope[] {
    return Array.from(this.revokedCapabilities);
  }

  registerCleanup(capability: unknown, cleanupFn: () => void): () => void {
    validateCapabilityScope(capability, this.pluginId);
    if (typeof cleanupFn !== "function") {
      throw new CapabilityError("Cleanup handler must be a function.", {
        code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
        capability,
        pluginId: this.pluginId,
      });
    }

    if (!this.activeCleanups.has(capability)) {
      this.activeCleanups.set(capability, new Set());
    }
    const cleanups = this.activeCleanups.get(capability)!;
    cleanups.add(cleanupFn);

    return () => {
      cleanups.delete(cleanupFn);
      if (cleanups.size === 0) {
        this.activeCleanups.delete(capability);
      }
    };
  }

  onCapabilitiesChanged(listener: (_controller: PluginCapabilityController) => void): () => void {
    if (typeof listener !== "function") return () => {};
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyChange(): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(this);
      } catch {
        // Prevent listener failures from interfering
      }
    });
  }

  dispose(): void {
    this.activeCleanups.forEach((cleanups) => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Safe disposal
        }
      });
      cleanups.clear();
    });
    this.activeCleanups.clear();
    this.changeListeners.clear();
  }
}

export interface SandboxedDashboardApiOptions {
  pluginId: string;
  controller: PluginCapabilityController;
  store: {
    getState: () => Record<string, unknown>;
    subscribe: (_listener: (_state: Record<string, unknown>) => void) => () => void;
  };
  manifest?: Record<string, unknown>;
}

export function createSandboxedDashboardApi({
  pluginId,
  controller,
  store,
  manifest,
}: SandboxedDashboardApiOptions) {
  const actions: Record<string, (..._args: unknown[]) => unknown> = {};

  SAFE_ACTION_KEYS.forEach((actionKey) => {
    actions[actionKey] = (..._args: unknown[]) => {
      controller.assertCapability("dashboard:write");
      const currentState = store.getState();
      const action = currentState[actionKey];
      if (typeof action === "function") {
        return (action as (..._a: unknown[]) => unknown)(..._args);
      }
      return undefined;
    };
  });

  const notifications = {
    add: (..._args: unknown[]) => {
      controller.assertCapability("notifications:write");
      const currentState = store.getState();
      const addNotification = currentState.addNotification;
      if (typeof addNotification === "function") {
        return (addNotification as (..._a: unknown[]) => unknown)(..._args);
      }
      return undefined;
    },
    remove: (..._args: unknown[]) => {
      controller.assertCapability("notifications:write");
      const currentState = store.getState();
      const removeNotification = currentState.removeNotification;
      if (typeof removeNotification === "function") {
        return (removeNotification as (..._a: unknown[]) => unknown)(..._args);
      }
      return undefined;
    },
  };

  const storage = {
    get: (key: string) => {
      controller.assertCapability("storage:read");
      if (typeof key !== "string" || !key) {
        throw new CapabilityError("Storage key must be a non-empty string.", {
          code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
          capability: "storage:read",
          pluginId,
        });
      }
      return getPluginIsolatedItem(pluginId, key);
    },
    list: () => {
      controller.assertCapability("storage:read");
      const storeMap = getPluginIsolatedStorage(pluginId);
      return Object.keys(storeMap);
    },
    getAll: () => {
      controller.assertCapability("storage:read");
      return freezePlainObject(getPluginIsolatedStorage(pluginId));
    },
    set: (key: string, value: unknown) => {
      controller.assertCapability("storage:write");
      if (typeof key !== "string" || !key) {
        throw new CapabilityError("Storage key must be a non-empty string.", {
          code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
          capability: "storage:write",
          pluginId,
        });
      }
      setPluginIsolatedItem(pluginId, key, value);
    },
    remove: (key: string) => {
      controller.assertCapability("storage:write");
      if (typeof key !== "string" || !key) {
        throw new CapabilityError("Storage key must be a non-empty string.", {
          code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
          capability: "storage:write",
          pluginId,
        });
      }
      removePluginIsolatedItem(pluginId, key);
    },
    clear: () => {
      controller.assertCapability("storage:write");
      clearPluginIsolatedStorage(pluginId);
    },
  };

  // eslint-disable-next-line no-undef
  const safeFetch = async (inputUrl: string, init?: RequestInit): Promise<Response> => {
    controller.assertCapability("network:request");
    if (typeof fetch === "undefined") {
      throw new CapabilityError("Fetch API is unsupported in this environment.", {
        code: CAPABILITY_ERROR_CODES.UNSUPPORTED_ENVIRONMENT,
        capability: "network:request",
        pluginId,
      });
    }

    const validUrl = sanitizeUrl(inputUrl, pluginId);
    return fetch(validUrl.toString(), init);
  };

  const safeOpenWindow = (url: string, target = "_blank", features = ""): Window | null => {
    controller.assertCapability("window:open");
    if (typeof window === "undefined" || typeof window.open !== "function") {
      throw new CapabilityError("window.open is unsupported in this environment.", {
        code: CAPABILITY_ERROR_CODES.UNSUPPORTED_ENVIRONMENT,
        capability: "window:open",
        pluginId,
      });
    }

    const validUrl = sanitizeUrl(url, pluginId);
    const safeFeatures = features ? `${features},noopener,noreferrer` : "noopener,noreferrer";
    return window.open(validUrl.toString(), target, safeFeatures);
  };

  return Object.freeze({
    pluginId,
    manifest: freezePlainObject(manifest || {}),
    controller,
    version: "2.0.0",

    getState: () => {
      controller.assertCapability("dashboard:read");
      return pickSafeState(store.getState());
    },

    getConfig: () => {
      controller.assertCapability("dashboard:read");
      return freezePlainObject({
        environment: getEnvironmentConfig(),
        activeProfileName: getActiveProfileName(),
        profiles: loadConfigProfiles(),
      });
    },

    subscribe: (listener: (_state: Record<string, unknown>) => void) => {
      controller.assertCapability("dashboard:read");
      if (typeof listener !== "function") {
        throw new CapabilityError("Listener must be a function.", {
          code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
          capability: "dashboard:read",
          pluginId,
        });
      }

      const unsubscribe = store.subscribe((rawState) => {
        // If capability has been revoked while subscription is alive, safely ignore
        if (!controller.hasCapability("dashboard:read")) return;
        listener(pickSafeState(rawState));
      });

      // Register cleanup with controller so revocation immediately cuts off the listener
      const unregisterCleanup = controller.registerCleanup("dashboard:read", () => {
        try {
          unsubscribe();
        } catch {
          // Safe disposal
        }
      });

      return () => {
        unregisterCleanup();
        unsubscribe();
      };
    },

    hasCapability: (capability: string) => controller.hasCapability(capability),
    getCapabilities: () => controller.getGrantedCapabilities(),

    actions: Object.freeze(actions),
    notifications: Object.freeze(notifications),
    storage: Object.freeze(storage),
    fetch: safeFetch,
    openWindow: safeOpenWindow,

    logger: Object.freeze({
      info: (...args: unknown[]) => console.info(`[plugin:${pluginId}]`, ...args),
      warn: (...args: unknown[]) => console.warn(`[plugin:${pluginId}]`, ...args),
      error: (...args: unknown[]) => console.error(`[plugin:${pluginId}]`, ...args),
    }),
  });
}

// ─── RPC Bridge for Sandboxed Iframes ──────────────────────────────────────────

export interface PluginRpcRequest {
  type: "PLUGIN_RPC_REQUEST";
  pluginId: string;
  requestId: string;
  capability: CapabilityScope;
  method: string;
  args?: unknown[];
}

export interface PluginRpcSubscribe {
  type: "PLUGIN_RPC_SUBSCRIBE";
  pluginId: string;
  subscriptionId: string;
  capability: "dashboard:read";
}

export interface PluginRpcUnsubscribe {
  type: "PLUGIN_RPC_UNSUBSCRIBE";
  pluginId: string;
  subscriptionId: string;
}

export interface PluginRpcResponse {
  type: "PLUGIN_RPC_RESPONSE";
  pluginId: string;
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    capability?: string;
  };
}

export interface PluginRpcEvent {
  type: "PLUGIN_RPC_EVENT";
  pluginId: string;
  subscriptionId: string;
  payload: unknown;
}

export interface PluginCapabilityRevokedEvent {
  type: "PLUGIN_CAPABILITY_REVOKED";
  pluginId: string;
  capability: CapabilityScope;
}

export type SandboxMessage =
  | PluginRpcRequest
  | PluginRpcSubscribe
  | PluginRpcUnsubscribe
  | PluginRpcResponse
  | PluginRpcEvent
  | PluginCapabilityRevokedEvent;

export function handlePluginRpcMessage(
  data: unknown,
  sourceWindow: unknown,
  options: {
    pluginId: string;
    controller: PluginCapabilityController;
    api: ReturnType<typeof createSandboxedDashboardApi>;
    targetWindow?: unknown;
    postMessage: (_message: SandboxMessage) => void;
    activeSubscriptions?: Map<string, () => void>;
  }
): boolean {
  if (!data || typeof data !== "object") return false;

  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== "string" || !msg.type.startsWith("PLUGIN_RPC_")) return false;

  // Verify source matches expected iframe window if provided
  if (options.targetWindow && sourceWindow !== options.targetWindow) {
    return false;
  }

  // Verify pluginId matches
  if (msg.pluginId !== options.pluginId) {
    return false;
  }

  const { controller, api, postMessage, activeSubscriptions = new Map() } = options;

  if (msg.type === "PLUGIN_RPC_REQUEST") {
    const requestId = typeof msg.requestId === "string" ? msg.requestId : `req-${Date.now()}`;
    const capability = msg.capability as CapabilityScope;
    const method = String(msg.method || "");
    const args = Array.isArray(msg.args) ? msg.args : [];

    try {
      controller.assertCapability(capability);

      let result: unknown;
      switch (capability) {
        case "dashboard:read":
          if (method === "getState") {
            result = api.getState();
          } else if (method === "getConfig") {
            result = api.getConfig();
          } else {
            throw new CapabilityError(`Unknown dashboard:read method "${method}".`, {
              code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
              capability,
              pluginId: options.pluginId,
            });
          }
          break;

        case "dashboard:write":
          if (typeof api.actions[method] === "function") {
            result = api.actions[method](...args);
          } else {
            throw new CapabilityError(`Unknown dashboard:write action "${method}".`, {
              code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
              capability,
              pluginId: options.pluginId,
            });
          }
          break;

        case "notifications:write":
          if (method === "add") {
            result = api.notifications.add(...args);
          } else if (method === "remove") {
            result = api.notifications.remove(...args);
          } else {
            throw new CapabilityError(`Unknown notifications:write method "${method}".`, {
              code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
              capability,
              pluginId: options.pluginId,
            });
          }
          break;

        case "storage:read":
          if (method === "get") {
            result = api.storage.get(String(args[0] || ""));
          } else if (method === "list") {
            result = api.storage.list();
          } else if (method === "getAll") {
            result = api.storage.getAll();
          } else {
            throw new CapabilityError(`Unknown storage:read method "${method}".`, {
              code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
              capability,
              pluginId: options.pluginId,
            });
          }
          break;

        case "storage:write":
          if (method === "set") {
            api.storage.set(String(args[0] || ""), args[1]);
            result = true;
          } else if (method === "remove") {
            api.storage.remove(String(args[0] || ""));
            result = true;
          } else if (method === "clear") {
            api.storage.clear();
            result = true;
          } else {
            throw new CapabilityError(`Unknown storage:write method "${method}".`, {
              code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
              capability,
              pluginId: options.pluginId,
            });
          }
          break;

        case "window:open":
          if (method === "open") {
            api.openWindow(String(args[0] || ""), String(args[1] || "_blank"), String(args[2] || ""));
            result = true;
          } else {
            throw new CapabilityError(`Unknown window:open method "${method}".`, {
              code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
              capability,
              pluginId: options.pluginId,
            });
          }
          break;

        default:
          throw new CapabilityError(`Unsupported capability execution: "${capability}".`, {
            code: CAPABILITY_ERROR_CODES.INVALID_INPUT,
            capability,
            pluginId: options.pluginId,
          });
      }

      postMessage({
        type: "PLUGIN_RPC_RESPONSE",
        pluginId: options.pluginId,
        requestId,
        success: true,
        result,
      });
      return true;
    } catch (err: unknown) {
      const errorObj = err instanceof CapabilityError
        ? { code: err.code, message: err.message, capability: err.capability }
        : { code: CAPABILITY_ERROR_CODES.EXECUTION_FAILED, message: (err as Error)?.message || String(err), capability };

      postMessage({
        type: "PLUGIN_RPC_RESPONSE",
        pluginId: options.pluginId,
        requestId,
        success: false,
        error: errorObj,
      });
      return true;
    }
  }

  if (msg.type === "PLUGIN_RPC_SUBSCRIBE") {
    const subscriptionId = String(msg.subscriptionId || "");
    const capability = msg.capability as CapabilityScope;

    try {
      controller.assertCapability(capability);

      const unsubscribe = api.subscribe((state) => {
        postMessage({
          type: "PLUGIN_RPC_EVENT",
          pluginId: options.pluginId,
          subscriptionId,
          payload: state,
        });
      });

      activeSubscriptions.set(subscriptionId, unsubscribe);
      return true;
    } catch (err: unknown) {
      const errorObj = err instanceof CapabilityError
        ? { code: err.code, message: err.message, capability: err.capability }
        : { code: CAPABILITY_ERROR_CODES.EXECUTION_FAILED, message: (err as Error)?.message || String(err), capability };

      postMessage({
        type: "PLUGIN_RPC_RESPONSE",
        pluginId: options.pluginId,
        requestId: subscriptionId,
        success: false,
        error: errorObj,
      });
      return true;
    }
  }

  if (msg.type === "PLUGIN_RPC_UNSUBSCRIBE") {
    const subscriptionId = String(msg.subscriptionId || "");
    const unsub = activeSubscriptions.get(subscriptionId);
    if (unsub) {
      unsub();
      activeSubscriptions.delete(subscriptionId);
    }
    return true;
  }

  return false;
}

// ─── Client SDK Helper for Sandboxed Iframe Extensions ─────────────────────────

export interface SandboxClient {
  pluginId: string;
  getState: () => Promise<Record<string, unknown>>;
  getConfig: () => Promise<Record<string, unknown>>;
  subscribe: (_callback: (_state: Record<string, unknown>) => void) => () => void;
  executeAction: (_action: string, ..._args: unknown[]) => Promise<unknown>;
  addNotification: (_notification: unknown) => Promise<unknown>;
  removeNotification: (_id: unknown) => Promise<unknown>;
  storage: {
    get: (_key: string) => Promise<unknown>;
    list: () => Promise<string[]>;
    getAll: () => Promise<Record<string, unknown>>;
    set: (_key: string, _value: unknown) => Promise<boolean>;
    remove: (_key: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
  };
  openWindow: (_url: string, _target?: string, _features?: string) => Promise<boolean>;
  onCapabilityRevoked: (_listener: (_capability: CapabilityScope) => void) => () => void;
  destroy: () => void;
}

export function createSandboxClient({
  pluginId,
  targetWindow = typeof window !== "undefined" ? window.parent : undefined,
  currentWindow = typeof window !== "undefined" ? window : undefined,
  timeoutMs = 5000,
}: {
  pluginId: string;
  targetWindow?: Window | { postMessage: (_msg: unknown, _targetOrigin: string) => void };
  currentWindow?: Window | {
    addEventListener: (_type: string, _listener: (_ev: MessageEvent) => void) => void;
    removeEventListener: (_type: string, _listener: (_ev: MessageEvent) => void) => void;
  };
  timeoutMs?: number;
}): SandboxClient {
  if (!currentWindow || !targetWindow || typeof currentWindow.addEventListener !== "function") {
    throw new CapabilityError("Sandbox client requires a window environment with postMessage support.", {
      code: CAPABILITY_ERROR_CODES.UNSUPPORTED_ENVIRONMENT,
      pluginId,
    });
  }

  const pendingRequests = new Map<
    string,
    {
      resolve: (_val: unknown) => void;
      reject: (_err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  const activeSubscriptions = new Map<string, (_payload: unknown) => void>();
  const revocationListeners = new Set<(_cap: CapabilityScope) => void>();

  const onMessage = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    const msg = data as Record<string, unknown>;

    if (msg.pluginId !== pluginId) return;

    if (msg.type === "PLUGIN_RPC_RESPONSE") {
      const requestId = String(msg.requestId || "");
      const pending = pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(requestId);

        if (msg.success) {
          pending.resolve(msg.result);
        } else {
          const errData = (msg.error || {}) as Record<string, unknown>;
          pending.reject(
            new CapabilityError(String(errData.message || "Capability request failed."), {
              code: String(errData.code || CAPABILITY_ERROR_CODES.EXECUTION_FAILED),
              capability: typeof errData.capability === "string" ? errData.capability : undefined,
              pluginId,
            })
          );
        }
      }
      return;
    }

    if (msg.type === "PLUGIN_RPC_EVENT") {
      const subscriptionId = String(msg.subscriptionId || "");
      const cb = activeSubscriptions.get(subscriptionId);
      if (cb) {
        cb(msg.payload);
      }
      return;
    }

    if (msg.type === "PLUGIN_CAPABILITY_REVOKED") {
      const cap = msg.capability as CapabilityScope;
      revocationListeners.forEach((listener) => {
        try {
          listener(cap);
        } catch {
          // Safe listener
        }
      });
    }
  };

  currentWindow.addEventListener("message", onMessage);

  function request(capability: CapabilityScope, method: string, args: unknown[] = []): Promise<unknown> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(
          new CapabilityError(`Request for capability "${capability}.${method}" timed out after ${timeoutMs}ms.`, {
            code: CAPABILITY_ERROR_CODES.EXECUTION_FAILED,
            capability,
            pluginId,
          })
        );
      }, timeoutMs);

      pendingRequests.set(requestId, { resolve, reject, timer });

      targetWindow!.postMessage(
        {
          type: "PLUGIN_RPC_REQUEST",
          pluginId,
          requestId,
          capability,
          method,
          args,
        },
        "*"
      );
    });
  }

  return {
    pluginId,

    getState: () => request("dashboard:read", "getState") as Promise<Record<string, unknown>>,
    getConfig: () => request("dashboard:read", "getConfig") as Promise<Record<string, unknown>>,

    subscribe: (callback) => {
      const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      activeSubscriptions.set(subscriptionId, callback as (_p: unknown) => void);

      targetWindow.postMessage(
        {
          type: "PLUGIN_RPC_SUBSCRIBE",
          pluginId,
          subscriptionId,
          capability: "dashboard:read",
        },
        "*"
      );

      return () => {
        activeSubscriptions.delete(subscriptionId);
        targetWindow.postMessage(
          {
            type: "PLUGIN_RPC_UNSUBSCRIBE",
            pluginId,
            subscriptionId,
          },
          "*"
        );
      };
    },

    executeAction: (action, ...args) => request("dashboard:write", action, args),

    addNotification: (notification) => request("notifications:write", "add", [notification]),
    removeNotification: (id) => request("notifications:write", "remove", [id]),

    storage: {
      get: (key) => request("storage:read", "get", [key]),
      list: () => request("storage:read", "list") as Promise<string[]>,
      getAll: () => request("storage:read", "getAll") as Promise<Record<string, unknown>>,
      set: (key, value) => request("storage:write", "set", [key, value]) as Promise<boolean>,
      remove: (key) => request("storage:write", "remove", [key]) as Promise<boolean>,
      clear: () => request("storage:write", "clear") as Promise<boolean>,
    },

    openWindow: (url, target = "_blank", features = "") =>
      request("window:open", "open", [url, target, features]) as Promise<boolean>,

    onCapabilityRevoked: (listener) => {
      revocationListeners.add(listener);
      return () => {
        revocationListeners.delete(listener);
      };
    },

    destroy: () => {
      currentWindow.removeEventListener("message", onMessage);
      pendingRequests.forEach((pending) => {
        clearTimeout(pending.timer);
        pending.reject(
          new CapabilityError("Sandbox client destroyed.", {
            code: CAPABILITY_ERROR_CODES.EXECUTION_FAILED,
            pluginId,
          })
        );
      });
      pendingRequests.clear();
      activeSubscriptions.clear();
      revocationListeners.clear();
    },
  };
}
