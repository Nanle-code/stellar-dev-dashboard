export const PLUGIN_PERMISSION_SCOPES = [
  "dashboard:read",
  "dashboard:write",
  "data:read",
  "data:write",
  "notifications:write",
  "network:request",
  "storage:read",
  "storage:write",
  "window:open",
] as const;

export type PluginPermissionScope = (typeof PLUGIN_PERMISSION_SCOPES)[number];

export type PluginExecutionMode = "module" | "iframe";

export interface PluginAuthor {
  name: string;
  url?: string;
}

export interface PluginRuntimeDescriptor {
  mode: PluginExecutionMode;
  entry?: string;
  source?: string;
  srcDoc?: string;
  sandbox?: string[];
}

export interface PluginWidgetDescriptor {
  id: string;
  title: string;
  placement: string;
  order?: number;
  kind?: "react" | "iframe";
  component?: unknown;
  src?: string;
  srcDoc?: string;
  sandbox?: string[];
  height?: number;
  props?: Record<string, unknown>;
}

export interface PluginDataSourceDescriptor {
  id: string;
  name: string;
  description?: string;
  fetch?: unknown;
  subscribe?: unknown;
  metadata?: Record<string, unknown>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  /**
   * The plugin API contract this plugin targets, as a semver string
   * (e.g. `"1.0.0"`). Defaults to the dashboard's supported API version when
   * omitted for backwards compatibility. See docs/plugins/API_VERSIONING.md.
   */
  apiVersion?: string;
  /** Optional plugin-author deprecation notice for this plugin itself. */
  deprecated?: {
    since: string;
    message: string;
    removalVersion?: string;
  };
  description?: string;
  author?: PluginAuthor | string;
  homepageUrl?: string;
  permissions?: PluginPermissionScope[];
  dependencies?: {
    plugins?: string[];
  };
  runtime: PluginRuntimeDescriptor;
  widgets?: PluginWidgetDescriptor[];
  dataSources?: PluginDataSourceDescriptor[];
}

/**
 * The currently supported plugin API contract version. Plugin manifests that
 * target a newer major version, or a minor/patch beyond what the dashboard
 * supports, are considered unsupported and will not activate.
 */
export const PLUGIN_API_VERSION = "1.0.0";

export interface PluginDefinition {
  manifest: PluginManifest;
  initialize?: (_api: unknown) => unknown | Promise<unknown>;
  getWidgets?: () => PluginWidgetDescriptor[];
  getDataSources?: () => PluginDataSourceDescriptor[];
}

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return definition;
}

export function createPluginManifest(
  manifest: PluginManifest
): PluginManifest {
  return {
    ...manifest,
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
    dependencies: {
      plugins: Array.isArray(manifest.dependencies?.plugins)
        ? manifest.dependencies?.plugins
        : [],
    },
    widgets: Array.isArray(manifest.widgets) ? manifest.widgets : [],
    dataSources: Array.isArray(manifest.dataSources) ? manifest.dataSources : [],
  };
}

export function createIframeWidget(
  widget: Omit<PluginWidgetDescriptor, "kind"> & { kind?: "iframe" }
): PluginWidgetDescriptor {
  return {
    ...widget,
    kind: "iframe",
  };
}

export function isPluginPermissionScope(value: unknown): value is PluginPermissionScope {
  return typeof value === "string" && (PLUGIN_PERMISSION_SCOPES as readonly string[]).includes(value);
}

export function comparePluginVersions(a: string, b: string): number {
  const parse = (value: string) =>
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

export {
  PLUGIN_API_VERSION as SUPPORTED_PLUGIN_API_VERSION,
  PLUGIN_API_VERSION_MAJOR,
  PLUGIN_API_VERSION_MINOR,
  PLUGIN_API_VERSION_PATCH,
  parseApiVersion,
  compareApiVersions,
  getApiVersionCompatibility,
  isPluginApiVersionSupported,
  getDeprecationNoticesForVersion,
  resolveApiVersion,
  PLUGIN_API_DEPRECATIONS,
} from "./pluginVersioning";

export type {
  ParsedApiVersion,
  PluginApiDeprecation,
  ApiVersionCompatibility,
  ApiVersionResolution,
} from "./pluginVersioning";
