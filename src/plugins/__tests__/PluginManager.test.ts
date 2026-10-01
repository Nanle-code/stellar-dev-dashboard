import { describe, expect, it, beforeEach, vi } from "vitest";
import { PluginManager, PLUGIN_STATUSES } from "../PluginManager";

function createMockStore() {
  const listeners = new Set();
  let state = {
    network: "testnet",
    theme: "dark",
    activeTab: "overview",
    connectedAddress: "GTEST",
  };

  return {
    getState: () => state,
    setState: (nextState) => {
      state = { ...state, ...nextState };
      listeners.forEach((listener) => listener(state));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const iframeManifest = {
  id: "community.test-extension",
  name: "Test Extension",
  version: "1.0.0",
  description: "A sandboxed extension used in unit tests.",
  permissions: ["dashboard:read"],
  runtime: {
    mode: "iframe",
    sandbox: ["allow-scripts"],
    srcDoc: "<html><body><p>Test extension</p></body></html>",
  },
  widgets: [
    {
      id: "community.test-extension.settings",
      title: "Test Extension",
      placement: "settings",
      kind: "iframe",
    },
  ],
  dataSources: [],
};

describe("PluginManager", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("installs sandboxed manifests, persists them, and exposes widgets", async () => {
    const manager = new PluginManager({ store: createMockStore() });

    await manager.installPlugin(iframeManifest);

    const records = manager.getPluginRecords();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(iframeManifest.id);
    expect(records[0].status).toBe(PLUGIN_STATUSES.INITIALIZED);

    const widgets = manager.getWidgets({ placement: "settings" });
    expect(widgets).toHaveLength(1);
    expect(widgets[0].pluginId).toBe(iframeManifest.id);

    const installedSnapshot = JSON.parse(localStorage.getItem("stellar-dashboard:plugins:v1"));
    expect(installedSnapshot.installed).toHaveLength(1);
    expect(installedSnapshot.installed[0].manifest.id).toBe(iframeManifest.id);
  });

  it("hydrates installed plugins from storage and removes them cleanly", async () => {
    const manager = new PluginManager({ store: createMockStore() });

    await manager.installPlugin(iframeManifest);
    await manager.uninstallPlugin(iframeManifest.id);

    expect(manager.getPluginRecords()).toHaveLength(0);

    const secondManager = new PluginManager({ store: createMockStore() });
    await secondManager.hydrateInstalledPlugins();
    expect(secondManager.getPluginRecords()).toHaveLength(0);
  });

  it("manages capability controllers and dynamic grant/revocation per plugin", async () => {
    const manager = new PluginManager({ store: createMockStore() });
    await manager.installPlugin(iframeManifest);

    const controller = manager.getCapabilityController(iframeManifest.id);
    expect(controller).toBeDefined();
    expect(manager.hasCapability(iframeManifest.id, "dashboard:read")).toBe(true);
    expect(manager.hasCapability(iframeManifest.id, "storage:write")).toBe(false);
    expect(manager.getGrantedCapabilities(iframeManifest.id)).toEqual(["dashboard:read"]);

    // Dynamically grant capability
    manager.grantCapability(iframeManifest.id, "storage:write");
    expect(manager.hasCapability(iframeManifest.id, "storage:write")).toBe(true);
    expect(manager.getGrantedCapabilities(iframeManifest.id)).toContain("storage:write");

    // Revoke individual capability
    manager.revokeCapability(iframeManifest.id, "dashboard:read");
    expect(manager.hasCapability(iframeManifest.id, "dashboard:read")).toBe(false);

    // Revoke all capabilities
    manager.revokeAllCapabilities(iframeManifest.id);
    expect(manager.getGrantedCapabilities(iframeManifest.id)).toEqual([]);

    // Uninstalling cleans up controller
    await manager.uninstallPlugin(iframeManifest.id);
    expect(manager.getCapabilityController(iframeManifest.id)).toBeUndefined();
  });
});
