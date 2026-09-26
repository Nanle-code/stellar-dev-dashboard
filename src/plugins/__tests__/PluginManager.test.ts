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

  it("exposes the resolved API version and compatibility on installed plugins", async () => {
    const manager = new PluginManager({ store: createMockStore() });
    await manager.installPlugin(iframeManifest);

    const records = manager.getPluginRecords();
    expect(records[0].apiVersion).toBeDefined();
    expect(records[0].apiVersionCompatibility).toBe("supported");
    expect(Array.isArray(records[0].deprecationNotices)).toBe(true);
  });

  it("rejects plugins targeting an unsupported future API version", () => {
    const manager = new PluginManager({ store: createMockStore() });

    expect(() =>
      manager.register(
        {
          id: "community.future-plugin",
          name: "Future Plugin",
          version: "1.0.0",
          apiVersion: "9.9.9",
          runtime: { mode: "iframe", srcDoc: "<html></html>" },
          widgets: [],
          dataSources: [],
        },
        { sourceType: "installed" }
      )
    ).toThrow(/apiVersion "9.9.9" is not supported/);

    // The dashboard's own version is still exposed as the supported baseline.
    expect(manager.getPluginRecords().length).toBe(0);
  });

  it("registers plugins that omit apiVersion (backwards compatible)", async () => {
    const manager = new PluginManager({ store: createMockStore() });

    const record = await manager.register(
      {
        id: "community.no-api-version",
        name: "No Api Version",
        version: "1.0.0",
        runtime: { mode: "iframe", srcDoc: "<html></html>" },
        widgets: [],
        dataSources: [],
      },
      { sourceType: "installed" }
    );

    expect(record).not.toBeNull();
    expect(record.apiVersionCompatibility).toBe("supported");
    expect(manager.canActivate(record).ok).toBe(true);
  });

  it("treats an invalid apiVersion string as unsupported", () => {
    const manager = new PluginManager({ store: createMockStore() });

    expect(() =>
      manager.register(
        {
          id: "community.bad-api-version",
          name: "Bad Api Version",
          version: "1.0.0",
          apiVersion: "not-a-version",
          runtime: { mode: "iframe", srcDoc: "<html></html>" },
          widgets: [],
          dataSources: [],
        },
        { sourceType: "installed" }
      )
    ).toThrow(/apiVersion "not-a-version" is not supported/);
  });

  it("still activates plugins targeting the supported API version", async () => {
    const manager = new PluginManager({ store: createMockStore() });

    const record = await manager.register(
      {
        id: "community.supported-plugin",
        name: "Supported Plugin",
        version: "1.2.3",
        apiVersion: "1.0.0",
        runtime: { mode: "iframe", srcDoc: "<html></html>" },
        widgets: [],
        dataSources: [],
      },
      { sourceType: "installed" }
    );

    expect(record.apiVersionCompatibility).toBe("supported");
    expect(manager.canActivate(record).ok).toBe(true);
  });
});
