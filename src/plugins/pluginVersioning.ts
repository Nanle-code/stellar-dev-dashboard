/**
 * Versioned public plugin API contract.
 *
 * The Stellar Dev Dashboard exposes a stable plugin interface to third-party
 * plugins. The interface has an API version that moves independently of the
 * dashboard's own release version, so plugin authors can declare exactly which
 * API contract they target and the runtime can enforce compatibility or emit
 * deprecation notices.
 *
 * Compatibility policy (Semantic Versioning):
 *  - MAJOR: breaking changes to the plugin interface. A plugin built for major N
 *    is NOT compatible with a dashboard supporting major M != N. Older major
 *    versions are reported as "deprecated"; newer major versions are reported
 *    as "unsupported" and the plugin is blocked from activating.
 *  - MINOR: additive, backward-compatible additions. A plugin may target a
 *    minor version newer than the dashboard supports only when the dashboard's
 *    minor >= the plugin's minor; otherwise the plugin requires an upgrade and
 *    is "unsupported".
 *  - PATCH: backward-compatible bug fixes. Always compatible within a MAJOR.
 *
 * See `docs/plugins/API_VERSIONING.md` for the full contract and migration notes.
 */

export const PLUGIN_API_VERSION = "1.0.0";
export const PLUGIN_API_VERSION_MAJOR = 1;
export const PLUGIN_API_VERSION_MINOR = 0;
export const PLUGIN_API_VERSION_PATCH = 0;

export type ApiVersionCompatibility =
  | "supported"
  | "deprecated"
  | "unsupported"
  | "invalid";

export interface ParsedApiVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export interface PluginApiDeprecation {
  /** The apiVersion this deprecation was introduced in. */
  since: string;
  /** The plugin API surface that is deprecated (e.g. a manifest field). */
  feature: string;
  /** Human-readable message shown to plugin authors. */
  message: string;
  /** apiVersion at which the deprecated surface will be removed, if known. */
  removalVersion?: string;
}

const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parse a semver-ish API version string into its components.
 *
 * Accepts `"1.0.0"` and numeric segments. Returns `null` for malformed values
 * (e.g. `"v1.2"`, `"1.2"`, `"abc"`, `""`), which the caller treats as
 * `invalid`/`unsupported`.
 */
export function parseApiVersion(version: unknown): ParsedApiVersion | null {
  if (typeof version !== "string") return null;
  const match = version.trim().match(VERSION_REGEX);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    raw: version.trim(),
  };
}

/**
 * Compare two API version strings. Returns a standard comparator:
 * negative when `a < b`, positive when `a > b`, 0 when equal.
 *
 * Invalid inputs are treated as `0.0.0` so the comparison never throws.
 */
export function compareApiVersions(a: string, b: string): number {
  const left = parseApiVersion(a) ?? { major: 0, minor: 0, patch: 0, raw: "0.0.0" };
  const right = parseApiVersion(b) ?? { major: 0, minor: 0, patch: 0, raw: "0.0.0" };

  const majorDiff = left.major - right.major;
  if (majorDiff !== 0) return majorDiff;

  const minorDiff = left.minor - right.minor;
  if (minorDiff !== 0) return minorDiff;

  return left.patch - right.patch;
}

/**
 * The dashboard-wide registry of deprecated plugin API surfaces. Each entry is
 * attached to a plugin record whose target `apiVersion` is >= the entry's
 * `since` version, so plugin authors learn about deprecations at install time.
 */
export const PLUGIN_API_DEPRECATIONS: PluginApiDeprecation[] = [
  {
    since: PLUGIN_API_VERSION,
    feature: "manifest.version",
    message:
      "manifest.version describes the plugin's own release, not the API contract. Use apiVersion to declare the plugin API version this plugin targets.",
    removalVersion: "2.0.0",
  },
  {
    since: PLUGIN_API_VERSION,
    feature: "runtime.sandbox",
    message:
      "iframe plugins run in a sandboxed browsing context. Review requested permissions and avoid embedding untrusted inline scripts in srcDoc.",
  },
];

/**
 * Determine the compatibility of a declared plugin `apiVersion` against the
 * dashboard's supported API version.
 *
 * - `"supported"`: the plugin targets the current major at a version <= what
 *   the dashboard ships (fully compatible).
 * - `"deprecated"`: the plugin targets an older major than the dashboard
 *   supports (still runnable, but scheduled for removal).
 * - `"unsupported"`: the plugin targets a newer major, or a minor/patch beyond
 *   what the dashboard supports. The plugin is blocked from activating.
 * - `"invalid"`: the version string could not be parsed.
 */
export function getApiVersionCompatibility(
  version: unknown
): ApiVersionCompatibility {
  const parsed = parseApiVersion(version);
  if (!parsed) return "invalid";

  if (parsed.major < PLUGIN_API_VERSION_MAJOR) return "deprecated";
  if (parsed.major > PLUGIN_API_VERSION_MAJOR) return "unsupported";

  // Same major: a plugin targeting a newer minor/patch than the dashboard
  // supports needs an upgrade and is therefore unsupported.
  if (compareApiVersions(parsed.raw, PLUGIN_API_VERSION) > 0) {
    return "unsupported";
  }

  return "supported";
}

/**
 * Short-circuited boolean version of {@link getApiVersionCompatibility}.
 */
export function isPluginApiVersionSupported(version: unknown): boolean {
  return getApiVersionCompatibility(version) === "supported";
}

/**
 * Return the deprecation notices that apply to plugins built against the given
 * `apiVersion` (i.e. introduced at or before that version). Returns an empty
 * array for unsupported/invalid versions.
 */
export function getDeprecationNoticesForVersion(
  version: unknown
): PluginApiDeprecation[] {
  const parsed = parseApiVersion(version);
  if (!parsed) return [];

  return PLUGIN_API_DEPRECATIONS.filter((dep) => {
    const since = parseApiVersion(dep.since);
    if (!since) return true;
    return compareApiVersions(parsed.raw, since.raw) >= 0;
  });
}

/**
 * Describe how a plugin manifest's `apiVersion` declaration should be handled
 * when it is missing entirely. Omitting `apiVersion` is allowed for backwards
 * compatibility; the dashboard defaults to its own version and emits a guidance
 * notice recommending the author declare it explicitly.
 */
export interface ApiVersionResolution {
  apiVersion: string;
  declared: boolean;
  compatibility: ApiVersionCompatibility;
  deprecationNotices: PluginApiDeprecation[];
}

export function resolveApiVersion(
  version: unknown
): ApiVersionResolution {
  if (version === null || version === undefined || version === "") {
    return {
      apiVersion: PLUGIN_API_VERSION,
      declared: false,
      compatibility: "supported",
      deprecationNotices: getDeprecationNoticesForVersion(PLUGIN_API_VERSION),
    };
  }

  const compatibility = getApiVersionCompatibility(version);
  return {
    apiVersion: String(version),
    declared: true,
    compatibility,
    deprecationNotices: getDeprecationNoticesForVersion(version) ?? [],
  };
}
