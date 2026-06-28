import React, { useEffect, useMemo, useState } from "react";
import { pluginManager, registerActivePlugins } from "../../plugins";
import { PLUGIN_STATUSES } from "../../plugins/PluginManager";

interface PluginWidget {
  id: string;
  component: React.ComponentType<Record<string, unknown>>;
  pluginName: string;
  title: string;
  pluginId: string;
  props?: Record<string, unknown>;
}

interface PluginRecord {
  id: string;
  name: string;
  status: string;
  error?: string;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  enabled?: boolean;
  sourceType?: string;
  permissionsGranted?: string[];
  permissionsRequested?: string[];
  dependencies?: string[];
  installedAt?: string | null;
}

interface MarketplacePlugin extends PluginRecord {
  description?: string;
  author?: string | { name: string };
  homepageUrl?: string | null;
  runtime?: { mode?: string };
  widgets?: Array<Record<string, unknown>>;
  dataSources?: Array<Record<string, unknown>>;
  installed?: boolean;
  installedVersion?: string | null;
}

interface PluginSnapshot {
  plugins: PluginRecord[];
  widgets: PluginWidget[];
  dataSources: unknown[];
  marketplace: MarketplacePlugin[];
}

function PluginWidgetFrame({ widget }: { widget: PluginWidget }) {
  const Component = widget.component;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {widget.pluginName}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700 }}>
            {widget.title}
          </div>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {widget.pluginId}
        </div>
      </div>
      <Component {...widget.props} />
    </div>
  );
}

function PluginStatusPill({ status }: { status: string }) {
  const colorByStatus: Record<string, string> = {
    [PLUGIN_STATUSES.INITIALIZED]: "var(--green)",
    [PLUGIN_STATUSES.REGISTERED]: "var(--cyan)",
    [PLUGIN_STATUSES.FAILED]: "var(--red)",
    [PLUGIN_STATUSES.BLOCKED]: "var(--amber)",
    [PLUGIN_STATUSES.PENDING_REVIEW]: "var(--amber)",
    [PLUGIN_STATUSES.DISABLED]: "var(--text-muted)",
  };

  return (
    <span
      style={{
        border: "1px solid var(--border)",
        borderRadius: "999px",
        color: colorByStatus[status] || "var(--text-secondary)",
        fontSize: "11px",
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function PermissionChip({ permission }: { permission: string }) {
  return (
    <span
      style={{
        borderRadius: "999px",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text-secondary)",
        fontSize: "10px",
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {permission}
    </span>
  );
}

function MarketplaceCard({
  plugin,
  onReview,
  onUpdate,
  onToggleEnabled,
  onUninstall,
  busy,
}: {
  plugin: MarketplacePlugin;
  onReview: (_plugin: MarketplacePlugin) => void;
  onUpdate: (_pluginId: string) => void;
  onToggleEnabled: (_pluginId: string, _nextEnabled: boolean) => void;
  onUninstall: (_pluginId: string) => void;
  busy: boolean;
}) {
  const isInstalled = Boolean(plugin.installed);
  const actionLabel = isInstalled ? (plugin.updateAvailable ? "Update" : "Details") : "Review";
  const permissions = Array.isArray(plugin.permissionsRequested) ? plugin.permissionsRequested : [];

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "14px",
        display: "grid",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {typeof plugin.author === "string" ? plugin.author : plugin.author?.name || "Community"}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700 }}>
            {plugin.name}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "12px", lineHeight: 1.5, marginTop: "6px" }}>
            {plugin.description}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: "8px" }}>
          <PluginStatusPill status={plugin.status} />
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
            v{plugin.version}
            {plugin.updateAvailable && plugin.latestVersion ? ` → v${plugin.latestVersion}` : ""}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {permissions.length > 0 ? permissions.map((permission) => (
          <PermissionChip key={permission} permission={permission} />
        )) : (
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>No permissions requested</span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (isInstalled && plugin.updateAvailable) {
              onUpdate(plugin.id);
              return;
            }

            onReview(plugin);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--cyan-dim)",
            background: "var(--cyan-glow)",
            color: "var(--cyan)",
            fontSize: "12px",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {actionLabel}
        </button>

        {isInstalled && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleEnabled(plugin.id, !plugin.enabled)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                fontSize: "12px",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {plugin.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUninstall(plugin.id)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(248, 113, 113, 0.4)",
                background: "rgba(248, 113, 113, 0.08)",
                color: "var(--red)",
                fontSize: "12px",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 700, marginTop: "4px" }}>
        {value}
      </div>
    </div>
  );
}

export default function PluginRegistryView({ placement = "settings" }: { placement?: string }) {
  const [snapshot, setSnapshot] = useState<PluginSnapshot>(() => ({
    plugins: pluginManager.getPluginRecords(),
    widgets: pluginManager.getWidgets({ placement }),
    dataSources: pluginManager.getDataSources(),
    marketplace: [],
  }));
  const [selectedPlugin, setSelectedPlugin] = useState<MarketplacePlugin | null>(null);
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const [marketplace, plugins, widgets, dataSources] = await Promise.all([
          pluginManager.getMarketplacePlugins(),
          Promise.resolve(pluginManager.getPluginRecords()),
          Promise.resolve(pluginManager.getWidgets({ placement })),
          Promise.resolve(pluginManager.getDataSources()),
        ]);

        if (!cancelled) {
          setSnapshot({ marketplace, plugins, widgets, dataSources });
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError?.message || String(refreshError));
        }
      }
    };

    refresh();
    const unsubscribe = pluginManager.subscribe(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [placement]);

  useEffect(() => {
    registerActivePlugins().catch((pluginError) => {
      setError(pluginError?.message || String(pluginError));
    });
  }, []);

  const pluginCount = snapshot.plugins.length;
  const dataSourceCount = snapshot.dataSources.length;
  const installedCount = snapshot.marketplace.filter((plugin) => plugin.installed).length;
  const updateCount = snapshot.marketplace.filter((plugin) => plugin.updateAvailable).length;

  const widgets = useMemo(() => snapshot.widgets, [snapshot.widgets]);

  const handleInstall = async (plugin: MarketplacePlugin) => {
    setBusyPluginId(plugin.id);
    setError(null);
    try {
      await pluginManager.installPlugin(plugin, {
        approvedPermissions: plugin.permissionsRequested || [],
      });
      setSelectedPlugin(null);
    } catch (installError) {
      setError(installError?.message || String(installError));
    } finally {
      setBusyPluginId(null);
    }
  };

  const handleUpdate = async (pluginId: string) => {
    setBusyPluginId(pluginId);
    setError(null);
    try {
      await pluginManager.updatePlugin(pluginId);
    } catch (updateError) {
      setError(updateError?.message || String(updateError));
    } finally {
      setBusyPluginId(null);
    }
  };

  const handleToggleEnabled = async (pluginId: string, nextEnabled: boolean) => {
    setBusyPluginId(pluginId);
    setError(null);
    try {
      await pluginManager.setPluginEnabled(pluginId, nextEnabled);
    } catch (toggleError) {
      setError(toggleError?.message || String(toggleError));
    } finally {
      setBusyPluginId(null);
    }
  };

  const handleRemove = async (pluginId: string) => {
    setBusyPluginId(pluginId);
    setError(null);
    try {
      await pluginManager.uninstallPlugin(pluginId);
      if (selectedPlugin?.id === pluginId) {
        setSelectedPlugin(null);
      }
    } catch (removeError) {
      setError(removeError?.message || String(removeError));
    } finally {
      setBusyPluginId(null);
    }
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.7))",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Extensions
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700 }}>
              Plugin Registry
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", color: "var(--text-secondary)", fontSize: "12px", flexWrap: "wrap" }}>
            <span>{pluginCount} installed</span>
            <span>{widgets.length} widgets</span>
            <span>{dataSourceCount} data sources</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
          <SummaryStat label="Installed" value={installedCount} />
          <SummaryStat label="Initialized" value={snapshot.plugins.filter((plugin) => plugin.status === PLUGIN_STATUSES.INITIALIZED).length} />
          <SummaryStat label="Updates" value={updateCount} />
          <SummaryStat label="Blocked" value={snapshot.plugins.filter((plugin) => plugin.status === PLUGIN_STATUSES.BLOCKED).length} />
        </div>

        {error && (
          <div style={{ color: "var(--red)", fontSize: "12px" }}>
            {error}
          </div>
        )}

        {snapshot.plugins.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
            Plugin discovery is running.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {snapshot.plugins.map((plugin) => (
              <div
                key={plugin.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "10px",
                  alignItems: "center",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 700 }}>
                    {plugin.name}
                  </div>
                  <div style={{ color: plugin.error ? "var(--red)" : "var(--text-muted)", fontSize: "11px" }}>
                    {plugin.error || plugin.id}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {plugin.updateAvailable ? (
                    <span style={{ color: "var(--amber)", fontSize: "11px" }}>Update available</span>
                  ) : null}
                  <PluginStatusPill status={plugin.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "12px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Marketplace
          </div>
          {snapshot.marketplace.map((plugin) => (
            <MarketplaceCard
              key={plugin.id}
              plugin={plugin}
              busy={busyPluginId === plugin.id}
              onReview={setSelectedPlugin}
              onUpdate={handleUpdate}
              onToggleEnabled={handleToggleEnabled}
              onUninstall={handleRemove}
            />
          ))}
          {snapshot.marketplace.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              No marketplace extensions available.
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "12px", position: "sticky", top: "12px" }}>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "14px",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Permission Review
            </div>
            {selectedPlugin ? (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700 }}>
                  {selectedPlugin.name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {selectedPlugin.description}
                </div>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
                    Requested permissions
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(selectedPlugin.permissionsRequested || []).map((permission) => (
                      <PermissionChip key={permission} permission={permission} />
                    ))}
                    {(!selectedPlugin.permissionsRequested || selectedPlugin.permissionsRequested.length === 0) && (
                      <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                        This extension requests no permissions.
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gap: "4px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <div>Version: {selectedPlugin.version}</div>
                  <div>Runtime: {selectedPlugin.runtime?.mode || "iframe"}</div>
                  <div>
                    Widgets: {Array.isArray(selectedPlugin.widgets) ? selectedPlugin.widgets.length : 0}
                  </div>
                  <div>
                    Dependencies: {(selectedPlugin.dependencies || []).length > 0
                      ? selectedPlugin.dependencies.join(", ")
                      : "none"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={busyPluginId === selectedPlugin.id}
                    onClick={() => handleInstall(selectedPlugin)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--cyan-dim)",
                      background: "var(--cyan-glow)",
                      color: "var(--cyan)",
                      fontSize: "12px",
                      cursor: busyPluginId === selectedPlugin.id ? "wait" : "pointer",
                    }}
                  >
                    Install with permissions
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlugin(null)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.6 }}>
                Select a marketplace extension to review its manifest, permissions, and sandbox mode before installation.
              </div>
            )}
          </div>

          {widgets.map((widget: PluginWidget) => (
            <PluginWidgetFrame key={widget.id} widget={widget} />
          ))}
        </div>
      </div>
    </section>
  );
}
