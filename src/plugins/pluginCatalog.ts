const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeIframeSrcDoc({ title, accent, body, footer }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
        --accent: ${accent};
      }
      html, body {
        margin: 0;
        min-height: 100%;
        background: #0c111b;
        color: #e8edf7;
        font-family: Inter, system-ui, sans-serif;
      }
      .shell {
        min-height: 100vh;
        box-sizing: border-box;
        padding: 16px;
        display: grid;
        gap: 12px;
        background:
          radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 30%, transparent), transparent 36%),
          linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0));
      }
      .card {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 18px;
        background: rgba(7, 11, 20, 0.86);
        box-shadow: 0 18px 50px rgba(0,0,0,0.35);
        padding: 14px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 10px;
        color: color-mix(in srgb, var(--accent) 70%, white);
      }
      h1 {
        margin: 8px 0 0;
        font-size: 18px;
        line-height: 1.2;
      }
      p {
        margin: 8px 0 0;
        color: #b6c0d4;
        line-height: 1.55;
        font-size: 12px;
      }
      .metric {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
        padding: 6px 10px;
        color: color-mix(in srgb, var(--accent) 75%, white);
        font-size: 11px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 18px var(--accent);
      }
      .footer {
        font-size: 11px;
        color: #8f9ab0;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="eyebrow">${title}</div>
        <h1>${title}</h1>
        <p>${body}</p>
        <div class="metric"><span class="dot"></span>Sandboxed extension preview</div>
      </div>
      <div class="footer">${footer}</div>
    </div>
  </body>
</html>`;
}

const MARKETPLACE_PLUGINS = [
  {
    id: "community.activity-radar",
    name: "Activity Radar",
    version: "1.2.0",
    description:
      "Surfaces recent dashboard activity in a compact, permission-scoped overview card.",
    author: "Community Labs",
    homepageUrl: "https://example.com/activity-radar",
    permissions: ["dashboard:read", "data:read"],
    runtime: {
      mode: "iframe",
      sandbox: ["allow-scripts"],
      srcDoc: makeIframeSrcDoc({
        title: "Activity Radar",
        accent: "#66d9ef",
        body:
          "Tracks the current network, active tab, and high-signal events without exposing write access to the host app.",
        footer: "Permissions: dashboard:read, data:read",
      }),
    },
    widgets: [
      {
        id: "community.activity-radar.settings",
        title: "Activity Radar",
        placement: "settings",
        order: 5,
        kind: "iframe",
        height: 220,
      },
    ],
    dataSources: [],
  },
  {
    id: "community.security-beacon",
    name: "Security Beacon",
    version: "1.0.3",
    description:
      "Highlights permission grants, plugin updates, and sensitive dashboard actions.",
    author: "Shield Collective",
    homepageUrl: "https://example.com/security-beacon",
    permissions: ["dashboard:read", "notifications:write"],
    runtime: {
      mode: "iframe",
      sandbox: ["allow-scripts"],
      srcDoc: makeIframeSrcDoc({
        title: "Security Beacon",
        accent: "#f97316",
        body:
          "Uses the plugin permission model to show how third-party extensions can request only the access they need.",
        footer: "Permissions: dashboard:read, notifications:write",
      }),
    },
    widgets: [
      {
        id: "community.security-beacon.settings",
        title: "Security Beacon",
        placement: "settings",
        order: 12,
        kind: "iframe",
        height: 220,
      },
    ],
    dataSources: [],
  },
  {
    id: "community.network-snapshot",
    name: "Network Snapshot",
    version: "0.9.8",
    description:
      "A sandboxed summary card that demonstrates dependency metadata and version management.",
    author: "Open Extensions",
    homepageUrl: "https://example.com/network-snapshot",
    permissions: ["dashboard:read"],
    dependencies: { plugins: ["core.runtime-status"] },
    runtime: {
      mode: "iframe",
      sandbox: ["allow-scripts"],
      srcDoc: makeIframeSrcDoc({
        title: "Network Snapshot",
        accent: "#34d399",
        body:
          "Uses the built-in runtime-status plugin as a dependency and shows how plugin manifests can declare load-order constraints.",
        footer: "Dependency: core.runtime-status",
      }),
    },
    widgets: [
      {
        id: "community.network-snapshot.settings",
        title: "Network Snapshot",
        placement: "settings",
        order: 20,
        kind: "iframe",
        height: 220,
      },
    ],
    dataSources: [],
  },
];

function clonePluginManifest(plugin) {
  return JSON.parse(JSON.stringify(plugin));
}

export async function fetchMarketplacePlugins() {
  await delay(200);
  return MARKETPLACE_PLUGINS.map(clonePluginManifest);
}

export async function fetchMarketplacePluginById(pluginId) {
  const catalog = await fetchMarketplacePlugins();
  return catalog.find((plugin) => plugin.id === pluginId) || null;
}

export function getMarketplacePluginIndex(pluginId) {
  return MARKETPLACE_PLUGINS.findIndex((plugin) => plugin.id === pluginId);
}

export function listMarketplacePluginSummaries() {
  return MARKETPLACE_PLUGINS.map(({ runtime, ...plugin }) => ({
    ...plugin,
    permissionCount: plugin.permissions.length,
    widgetCount: Array.isArray(plugin.widgets) ? plugin.widgets.length : 0,
    executionMode: runtime?.mode || "iframe",
  }));
}

export { MARKETPLACE_PLUGINS };
