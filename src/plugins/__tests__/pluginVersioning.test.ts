import { describe, it, expect } from "vitest";
import {
  PLUGIN_API_VERSION,
  parseApiVersion,
  compareApiVersions,
  getApiVersionCompatibility,
  isPluginApiVersionSupported,
  getDeprecationNoticesForVersion,
  resolveApiVersion,
  PLUGIN_API_DEPRECATIONS,
} from "../pluginVersioning";

describe("parseApiVersion", () => {
  it("parses valid semver strings", () => {
    expect(parseApiVersion("1.0.0")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      raw: "1.0.0",
    });
    expect(parseApiVersion("2.3.4")).toEqual({
      major: 2,
      minor: 3,
      patch: 4,
      raw: "2.3.4",
    });
  });

  it("rejects malformed versions (failure cases)", () => {
    expect(parseApiVersion("1.2")).toBeNull();
    expect(parseApiVersion("v1.2.3")).toBeNull();
    expect(parseApiVersion("abc")).toBeNull();
    expect(parseApiVersion("")).toBeNull();
    expect(parseApiVersion(null)).toBeNull();
    expect(parseApiVersion(undefined)).toBeNull();
    expect(parseApiVersion(1)).toBeNull();
    expect(parseApiVersion("1.0.0-beta")).toBeNull();
  });

  it("boundary: accepts zero versions", () => {
    expect(parseApiVersion("0.0.0")).toEqual({
      major: 0,
      minor: 0,
      patch: 0,
      raw: "0.0.0",
    });
  });
});

describe("compareApiVersions", () => {
  it("primary flow: orders versions by major, minor, then patch", () => {
    expect(compareApiVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareApiVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(compareApiVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareApiVersions("2.0.0", "1.9.9")).toBe(1);
  });

  it("treats invalid versions as 0.0.0 without throwing", () => {
    expect(compareApiVersions("garbage", "0.0.0")).toBe(0);
    expect(compareApiVersions("1.0.0", "garbage")).toBe(1);
  });
});

describe("getApiVersionCompatibility", () => {
  it("primary flow: the dashboard's own version is supported", () => {
    expect(getApiVersionCompatibility(PLUGIN_API_VERSION)).toBe("supported");
    expect(getApiVersionCompatibility("1.0.0")).toBe("supported");
  });

  it("a newer minor/patch in the same major is unsupported (requires upgrade)", () => {
    expect(getApiVersionCompatibility("1.1.0")).toBe("unsupported");
    expect(getApiVersionCompatibility("1.0.1")).toBe("unsupported");
  });

  it("a newer major is unsupported (plugin targets a future breaking API)", () => {
    expect(getApiVersionCompatibility("2.0.0")).toBe("unsupported");
    expect(getApiVersionCompatibility("3.1.2")).toBe("unsupported");
  });

  it("an older major is deprecated but still recognised", () => {
    expect(getApiVersionCompatibility("0.9.0")).toBe("deprecated");
    expect(getApiVersionCompatibility("0.1.0")).toBe("deprecated");
  });

  it("an identical older minor/patch within the current major is supported", () => {
    // Dashboard is 1.0.0, so 1.0.0 and anything <= 1.0.0 is supported.
    expect(getApiVersionCompatibility("1.0.0")).toBe("supported");
  });

  it("failure path: invalid input is reported as invalid", () => {
    expect(getApiVersionCompatibility("not-a-version")).toBe("invalid");
    expect(getApiVersionCompatibility("")).toBe("invalid");
    expect(getApiVersionCompatibility(null)).toBe("invalid");
  });

  it("boundary: missing/empty version is invalid from this helper", () => {
    expect(getApiVersionCompatibility(undefined)).toBe("invalid");
  });
});

describe("isPluginApiVersionSupported", () => {
  it("returns true only for supported versions", () => {
    expect(isPluginApiVersionSupported("1.0.0")).toBe(true);
    expect(isPluginApiVersionSupported("2.0.0")).toBe(false);
    expect(isPluginApiVersionSupported("0.9.0")).toBe(false);
    expect(isPluginApiVersionSupported("garbage")).toBe(false);
  });
});

describe("getDeprecationNoticesForVersion", () => {
  it("returns the active registry of deprecation notices", () => {
    const notices = getDeprecationNoticesForVersion("1.0.0");
    expect(notices.length).toBeGreaterThan(0);
    expect(PLUGIN_API_DEPRECATIONS).toContainEqual(notices[0]);
  });

  it("returns an empty array for invalid versions", () => {
    expect(getDeprecationNoticesForVersion("not-a-version")).toEqual([]);
    expect(getDeprecationNoticesForVersion(null)).toEqual([]);
  });
});

describe("resolveApiVersion", () => {
  it("primary flow: explicitly declared supported version", () => {
    const resolution = resolveApiVersion("1.0.0");
    expect(resolution.apiVersion).toBe("1.0.0");
    expect(resolution.declared).toBe(true);
    expect(resolution.compatibility).toBe("supported");
  });

  it("defaults undeclared version to the dashboard version (backwards compatible)", () => {
    const resolution = resolveApiVersion(undefined);
    expect(resolution.apiVersion).toBe(PLUGIN_API_VERSION);
    expect(resolution.declared).toBe(false);
    expect(resolution.compatibility).toBe("supported");
  });

  it("failure path: unsupported explicit version is flagged", () => {
    const resolution = resolveApiVersion("9.9.9");
    expect(resolution.declared).toBe(true);
    expect(resolution.compatibility).toBe("unsupported");
  });

  it("boundary: empty string is treated as undeclared", () => {
    const resolution = resolveApiVersion("");
    expect(resolution.declared).toBe(false);
    expect(resolution.compatibility).toBe("supported");
  });
});
