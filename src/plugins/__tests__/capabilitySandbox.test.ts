import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  CAPABILITY_SCOPES,
  CAPABILITY_ERROR_CODES,
  CapabilityError,
  isCapabilityScope,
  validateCapabilityScope,
  pickSafeState,
  PluginCapabilityController,
  createSandboxedDashboardApi,
  handlePluginRpcMessage,
  createSandboxClient,
} from "../capabilitySandbox";
import {
  getPluginIsolatedStorage,
  clearPluginIsolatedStorage,
  getPluginIsolatedItem,
  setPluginIsolatedItem,
} from "../pluginStorage";

function createMockStore(initialState: Record<string, unknown> = {}) {
  const listeners = new Set<(_state: Record<string, unknown>) => void>();
  let state: Record<string, unknown> = {
    network: "testnet",
    theme: "dark",
    activeTab: "overview",
    connectedAddress: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVTHZ",
    sensitiveSecretKey: "SXXXXXXXDO_NOT_LEAK",
    internalAdminToken: "super-secret-token",
    ...initialState,
  };

  return {
    getState: () => state,
    setState: (nextState: Record<string, unknown>) => {
      state = { ...state, ...nextState };
      listeners.forEach((listener) => listener(state));
    },
    subscribe: (listener: (_state: Record<string, unknown>) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getListenerCount: () => listeners.size,
  };
}

describe("Plugin Capability Sandbox", () => {
  const testPluginId = "stellar.eco.sample-extension";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearPluginIsolatedStorage(testPluginId);
  });

  describe("Capability Validation & Error Classes", () => {
    it("validates recognized and unrecognized capability scopes", () => {
      expect(isCapabilityScope("dashboard:read")).toBe(true);
      expect(isCapabilityScope("storage:write")).toBe(true);
      expect(isCapabilityScope("network:request")).toBe(true);
      expect(isCapabilityScope("arbitrary:scope")).toBe(false);
      expect(isCapabilityScope(null)).toBe(false);
      expect(isCapabilityScope(123)).toBe(false);

      expect(() => validateCapabilityScope("dashboard:read")).not.toThrow();
      expect(() => validateCapabilityScope("unknown:capability", testPluginId)).toThrow(CapabilityError);

      try {
        validateCapabilityScope("invalid:permission", testPluginId);
      } catch (err) {
        expect(err).toBeInstanceOf(CapabilityError);
        const capErr = err as CapabilityError;
        expect(capErr.code).toBe(CAPABILITY_ERROR_CODES.INVALID_SCOPE);
        expect(capErr.pluginId).toBe(testPluginId);
      }
    });

    it("requires non-empty plugin ID in controller constructor", () => {
      expect(() => new PluginCapabilityController("")).toThrow(CapabilityError);
      // @ts-expect-error test invalid type
      expect(() => new PluginCapabilityController(null)).toThrow(CapabilityError);
    });
  });

  describe("PluginCapabilityController Lifecycle", () => {
    it("primary flow: grants, asserts, and checks capabilities dynamically", () => {
      const controller = new PluginCapabilityController(testPluginId, ["dashboard:read"]);

      expect(controller.hasCapability("dashboard:read")).toBe(true);
      expect(controller.hasCapability("storage:write")).toBe(false);
      expect(controller.getGrantedCapabilities()).toEqual(["dashboard:read"]);

      expect(() => controller.assertCapability("dashboard:read")).not.toThrow();

      // Dynamically grant new capability
      controller.grant("storage:write");
      expect(controller.hasCapability("storage:write")).toBe(true);
      expect(() => controller.assertCapability("storage:write")).not.toThrow();

      // Revoke capability safely
      controller.revoke("dashboard:read");
      expect(controller.hasCapability("dashboard:read")).toBe(false);
      expect(controller.getGrantedCapabilities()).toEqual(["storage:write"]);
      expect(controller.getRevokedCapabilities()).toContain("dashboard:read");

      // Asserting a revoked capability throws ERR_CAPABILITY_REVOKED
      expect(() => controller.assertCapability("dashboard:read")).toThrow(CapabilityError);
      try {
        controller.assertCapability("dashboard:read");
      } catch (err) {
        const capErr = err as CapabilityError;
        expect(capErr.code).toBe(CAPABILITY_ERROR_CODES.REVOKED);
        expect(capErr.capability).toBe("dashboard:read");
      }
    });

    it("boundary case: empty initial capabilities deny all scopes", () => {
      const controller = new PluginCapabilityController(testPluginId, []);

      expect(controller.getGrantedCapabilities()).toEqual([]);
      CAPABILITY_SCOPES.forEach((scope) => {
        expect(controller.hasCapability(scope)).toBe(false);
        expect(() => controller.assertCapability(scope)).toThrow(CapabilityError);
      });
    });

    it("boundary case: re-granting a revoked capability clears revocation", () => {
      const controller = new PluginCapabilityController(testPluginId, ["storage:read"]);
      controller.revoke("storage:read");
      expect(controller.hasCapability("storage:read")).toBe(false);
      expect(controller.getRevokedCapabilities()).toContain("storage:read");

      controller.grant("storage:read");
      expect(controller.hasCapability("storage:read")).toBe(true);
      expect(controller.getRevokedCapabilities()).not.toContain("storage:read");
      expect(() => controller.assertCapability("storage:read")).not.toThrow();
    });

    it("triggers registered cleanups when capability is revoked or revokeAll is called", () => {
      const controller = new PluginCapabilityController(testPluginId, ["dashboard:read", "data:read"]);
      const cleanupRead = vi.fn();
      const cleanupData = vi.fn();

      controller.registerCleanup("dashboard:read", cleanupRead);
      controller.registerCleanup("data:read", cleanupData);

      controller.revoke("dashboard:read");
      expect(cleanupRead).toHaveBeenCalledTimes(1);
      expect(cleanupData).not.toHaveBeenCalled();

      controller.revokeAll();
      expect(cleanupData).toHaveBeenCalledTimes(1);
      expect(controller.getGrantedCapabilities()).toEqual([]);
    });

    it("notifies change listeners when capabilities change", () => {
      const controller = new PluginCapabilityController(testPluginId);
      const listener = vi.fn();
      const unsubscribe = controller.onCapabilitiesChanged(listener);

      controller.grant("notifications:write");
      expect(listener).toHaveBeenCalledWith(controller);

      controller.revoke("notifications:write");
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      controller.grant("window:open");
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("Safe State Filtering", () => {
    it("filters out sensitive or non-whitelisted properties", () => {
      const rawState = {
        network: "mainnet",
        theme: "dark",
        connectedAddress: "GABC...",
        secretSeed: "SXXXXX",
        apiKey: "12345",
        userPasswords: ["p1", "p2"],
      };

      const safe = pickSafeState(rawState);
      expect(safe.network).toBe("mainnet");
      expect(safe.theme).toBe("dark");
      expect(safe.connectedAddress).toBe("GABC...");
      expect((safe as Record<string, unknown>).secretSeed).toBeUndefined();
      expect((safe as Record<string, unknown>).apiKey).toBeUndefined();
      expect((safe as Record<string, unknown>).userPasswords).toBeUndefined();
    });

    it("returns an empty frozen object for null or undefined input", () => {
      expect(pickSafeState(null)).toEqual({});
      expect(pickSafeState(undefined)).toEqual({});
      expect(Object.isFrozen(pickSafeState(null))).toBe(true);
    });
  });

  describe("createSandboxedDashboardApi Guarding", () => {
    it("primary flow: allows dashboard:read to read safe state and configuration", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["dashboard:read"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const state = api.getState();
      expect(state.network).toBe("testnet");
      expect(state.connectedAddress).toBe("GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVTHZ");
      expect((state as Record<string, unknown>).sensitiveSecretKey).toBeUndefined();

      const config = api.getConfig();
      expect(config).toBeDefined();
    });

    it("failure path: throws ERR_CAPABILITY_NOT_GRANTED when dashboard:read is missing", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, []);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      expect(() => api.getState()).toThrow(CapabilityError);
      expect(() => api.getConfig()).toThrow(CapabilityError);
      expect(() => api.subscribe(() => {})).toThrow(CapabilityError);
    });

    it("subscription lifecycle: automatically detaches listeners when capability is revoked", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["dashboard:read"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const receivedStates: unknown[] = [];
      const unsubscribe = api.subscribe((s) => receivedStates.push(s));

      expect(store.getListenerCount()).toBe(1);

      store.setState({ theme: "light" });
      expect(receivedStates.length).toBe(1);
      expect((receivedStates[0] as Record<string, unknown>).theme).toBe("light");

      // Revoking capability dashboard:read should auto-unsubscribe the listener
      controller.revoke("dashboard:read");
      expect(store.getListenerCount()).toBe(0);

      store.setState({ theme: "system" });
      expect(receivedStates.length).toBe(1); // No new callbacks

      unsubscribe();
    });

    it("storage capability isolation: allows storage:read and storage:write within plugin namespace", () => {
      const otherPluginId = "community.other-plugin";
      setPluginIsolatedItem(otherPluginId, "sharedKey", "secret-of-other");

      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["storage:read", "storage:write"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      // Write item
      api.storage.set("myKey", { setting: "value1" });
      expect(api.storage.get("myKey")).toEqual({ setting: "value1" });
      expect(api.storage.list()).toEqual(["myKey"]);

      // Verify other plugin's data is isolated and cannot be accessed
      expect(api.storage.get("sharedKey")).toBeUndefined();
      const rawAll = getPluginIsolatedStorage(testPluginId);
      expect(rawAll.sharedKey).toBeUndefined();

      // Remove and clear
      api.storage.remove("myKey");
      expect(api.storage.get("myKey")).toBeUndefined();

      api.storage.set("k1", 1);
      api.storage.set("k2", 2);
      expect(api.storage.list().length).toBe(2);
      api.storage.clear();
      expect(api.storage.list().length).toBe(0);

      // Verify other plugin data remains intact after clear
      expect(getPluginIsolatedItem(otherPluginId, "sharedKey")).toBe("secret-of-other");
      clearPluginIsolatedStorage(otherPluginId);
    });

    it("storage failure paths: throws when permissions are absent or keys are invalid", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, []);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      // Missing storage:write
      expect(() => api.storage.set("key", "val")).toThrow(CapabilityError);
      expect(() => api.storage.remove("key")).toThrow(CapabilityError);
      expect(() => api.storage.clear()).toThrow(CapabilityError);

      // Missing storage:read
      expect(() => api.storage.get("key")).toThrow(CapabilityError);
      expect(() => api.storage.list()).toThrow(CapabilityError);
      expect(() => api.storage.getAll()).toThrow(CapabilityError);

      // Grant write and verify invalid key handling
      controller.grant("storage:write");
      expect(() => api.storage.set("", "val")).toThrow(CapabilityError);
      // @ts-expect-error test non-string
      expect(() => api.storage.set(null, "val")).toThrow(CapabilityError);
    });

    it("network request capability: protocol validation and error handling", async () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["network:request"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
      vi.stubGlobal("fetch", mockFetch);

      const res = await api.fetch("https://horizon-testnet.stellar.org");
      expect(res).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();

      // Protocol rejection for javascript: or file:
      await expect(api.fetch("javascript:alert(1)")).rejects.toThrow(CapabilityError);
      await expect(api.fetch("file:///etc/passwd")).rejects.toThrow(CapabilityError);
      await expect(api.fetch("")).rejects.toThrow(CapabilityError);

      // Revoking network capability
      controller.revoke("network:request");
      await expect(api.fetch("https://horizon-testnet.stellar.org")).rejects.toThrow(CapabilityError);

      vi.unstubAllGlobals();
    });

    it("window:open capability: validates url and opens with safe flags", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["window:open"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const openSpy = vi.fn().mockReturnValue({} as Window);
      vi.stubGlobal("window", {
        ...window,
        open: openSpy,
      });

      api.openWindow("https://stellar.org", "_blank", "width=800");
      expect(openSpy).toHaveBeenCalledWith(
        "https://stellar.org/",
        "_blank",
        "width=800,noopener,noreferrer"
      );

      // Boundary: revoke window:open
      controller.revoke("window:open");
      expect(() => api.openWindow("https://stellar.org")).toThrow(CapabilityError);

      vi.unstubAllGlobals();
    });
  });

  describe("handlePluginRpcMessage RPC Protocol", () => {
    it("primary flow: processes valid PLUGIN_RPC_REQUEST and dispatches success response", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["dashboard:read", "storage:write", "storage:read"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const mockTargetWindow = {} as Window;
      const sentMessages: unknown[] = [];
      const postMessage = (msg: unknown) => sentMessages.push(msg);

      const handled = handlePluginRpcMessage(
        {
          type: "PLUGIN_RPC_REQUEST",
          pluginId: testPluginId,
          requestId: "req-1",
          capability: "dashboard:read",
          method: "getState",
          args: [],
        },
        mockTargetWindow,
        {
          pluginId: testPluginId,
          controller,
          api,
          targetWindow: mockTargetWindow,
          postMessage,
        }
      );

      expect(handled).toBe(true);
      expect(sentMessages).toHaveLength(1);
      const reply = sentMessages[0] as Record<string, unknown>;
      expect(reply.type).toBe("PLUGIN_RPC_RESPONSE");
      expect(reply.requestId).toBe("req-1");
      expect(reply.success).toBe(true);
      expect((reply.result as Record<string, unknown>).network).toBe("testnet");
    });

    it("failure path: returns error response when capability is ungranted or revoked", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, []);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const mockTargetWindow = {} as Window;
      const sentMessages: unknown[] = [];
      const postMessage = (msg: unknown) => sentMessages.push(msg);

      handlePluginRpcMessage(
        {
          type: "PLUGIN_RPC_REQUEST",
          pluginId: testPluginId,
          requestId: "req-2",
          capability: "dashboard:read",
          method: "getState",
        },
        mockTargetWindow,
        {
          pluginId: testPluginId,
          controller,
          api,
          targetWindow: mockTargetWindow,
          postMessage,
        }
      );

      expect(sentMessages).toHaveLength(1);
      const reply = sentMessages[0] as Record<string, unknown>;
      expect(reply.type).toBe("PLUGIN_RPC_RESPONSE");
      expect(reply.requestId).toBe("req-2");
      expect(reply.success).toBe(false);
      expect((reply.error as Record<string, unknown>).code).toBe(CAPABILITY_ERROR_CODES.NOT_GRANTED);
    });

    it("security check: ignores messages from mismatched origin or foreign pluginId", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["dashboard:read"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const mockTargetWindow = {} as Window;
      const wrongWindow = {} as Window;
      const sentMessages: unknown[] = [];
      const postMessage = (msg: unknown) => sentMessages.push(msg);

      // Wrong window source
      const res1 = handlePluginRpcMessage(
        {
          type: "PLUGIN_RPC_REQUEST",
          pluginId: testPluginId,
          requestId: "req-3",
          capability: "dashboard:read",
          method: "getState",
        },
        wrongWindow,
        {
          pluginId: testPluginId,
          controller,
          api,
          targetWindow: mockTargetWindow,
          postMessage,
        }
      );
      expect(res1).toBe(false);
      expect(sentMessages).toHaveLength(0);

      // Wrong pluginId in message payload
      const res2 = handlePluginRpcMessage(
        {
          type: "PLUGIN_RPC_REQUEST",
          pluginId: "foreign-plugin",
          requestId: "req-4",
          capability: "dashboard:read",
          method: "getState",
        },
        mockTargetWindow,
        {
          pluginId: testPluginId,
          controller,
          api,
          targetWindow: mockTargetWindow,
          postMessage,
        }
      );
      expect(res2).toBe(false);
      expect(sentMessages).toHaveLength(0);
    });

    it("supports subscription protocol and unsubscription via RPC", () => {
      const store = createMockStore();
      const controller = new PluginCapabilityController(testPluginId, ["dashboard:read"]);
      const api = createSandboxedDashboardApi({ pluginId: testPluginId, controller, store });

      const mockTargetWindow = {} as Window;
      const sentMessages: unknown[] = [];
      const postMessage = (msg: unknown) => sentMessages.push(msg);
      const activeSubscriptions = new Map<string, () => void>();

      handlePluginRpcMessage(
        {
          type: "PLUGIN_RPC_SUBSCRIBE",
          pluginId: testPluginId,
          subscriptionId: "sub-100",
          capability: "dashboard:read",
        },
        mockTargetWindow,
        {
          pluginId: testPluginId,
          controller,
          api,
          targetWindow: mockTargetWindow,
          postMessage,
          activeSubscriptions,
        }
      );

      expect(activeSubscriptions.has("sub-100")).toBe(true);

      // Trigger store change -> sends event
      store.setState({ theme: "high-contrast" });
      const events = sentMessages.filter((m) => (m as Record<string, unknown>).type === "PLUGIN_RPC_EVENT");
      expect(events.length).toBeGreaterThan(0);
      expect(((events[0] as Record<string, unknown>).payload as Record<string, unknown>).theme).toBe("high-contrast");

      // Unsubscribe
      handlePluginRpcMessage(
        {
          type: "PLUGIN_RPC_UNSUBSCRIBE",
          pluginId: testPluginId,
          subscriptionId: "sub-100",
        },
        mockTargetWindow,
        {
          pluginId: testPluginId,
          controller,
          api,
          targetWindow: mockTargetWindow,
          postMessage,
          activeSubscriptions,
        }
      );

      expect(activeSubscriptions.has("sub-100")).toBe(false);
    });
  });

  describe("createSandboxClient Helper", () => {
    it("handles postMessage round-trip RPC with response matching", async () => {
      const messageListeners: ((_ev: MessageEvent) => void)[] = [];

      const fakeCurrentWindow = {
        addEventListener: (_type: string, listener: (_ev: MessageEvent) => void) => {
          messageListeners.push(listener);
        },
        removeEventListener: (_type: string, listener: (_ev: MessageEvent) => void) => {
          const idx = messageListeners.indexOf(listener);
          if (idx !== -1) messageListeners.splice(idx, 1);
        },
      };

      const outboundMessages: unknown[] = [];
      const fakeTargetWindow = {
        postMessage: (msg: unknown) => {
          outboundMessages.push(msg);
          const req = msg as Record<string, unknown>;
          if (req.type === "PLUGIN_RPC_REQUEST" && req.method === "getState") {
            // Simulate host responding back
            messageListeners.forEach((l) =>
              l({
                data: {
                  type: "PLUGIN_RPC_RESPONSE",
                  pluginId: testPluginId,
                  requestId: req.requestId,
                  success: true,
                  result: { network: "futurenet" },
                },
              } as MessageEvent)
            );
          }
        },
      };

      const client = createSandboxClient({
        pluginId: testPluginId,
        targetWindow: fakeTargetWindow as unknown as Window,
        currentWindow: fakeCurrentWindow as unknown as Window,
      });

      const state = await client.getState();
      expect(state).toEqual({ network: "futurenet" });

      client.destroy();
    });

    it("listens to capability revocation broadcasts from host", () => {
      const messageListeners: ((_ev: MessageEvent) => void)[] = [];
      const fakeCurrentWindow = {
        addEventListener: (_type: string, listener: (_ev: MessageEvent) => void) => {
          messageListeners.push(listener);
        },
        removeEventListener: (_type: string, listener: (_ev: MessageEvent) => void) => {
          const idx = messageListeners.indexOf(listener);
          if (idx !== -1) messageListeners.splice(idx, 1);
        },
      };
      const fakeTargetWindow = { postMessage: vi.fn() };

      const client = createSandboxClient({
        pluginId: testPluginId,
        targetWindow: fakeTargetWindow as unknown as Window,
        currentWindow: fakeCurrentWindow as unknown as Window,
      });

      const revokedScopes: string[] = [];
      const unsub = client.onCapabilityRevoked((scope) => revokedScopes.push(scope));

      messageListeners.forEach((l) =>
        l({
          data: {
            type: "PLUGIN_CAPABILITY_REVOKED",
            pluginId: testPluginId,
            capability: "dashboard:read",
          },
        } as MessageEvent)
      );

      expect(revokedScopes).toEqual(["dashboard:read"]);

      unsub();
      client.destroy();
    });
  });
});
