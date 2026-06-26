import { describe, expect, it } from "vitest";
import {
  applyPreferencePreset,
  createPreferencePreset,
  CURRENT_PREFERENCE_SCHEMA_VERSION,
  DEFAULT_PREFERENCES,
  exportPreferences,
  getPreferenceSyncStatus,
  importPreferences,
  importSharedPreferencePreset,
  migratePreferences,
  PREFERENCE_SCHEMA,
  resolvePreferenceConflicts,
  setAdvancedPreference,
  sharePreferencePreset,
  validatePreferences,
} from "../userPreferences";

describe("advanced user preferences", () => {
  it("defines more than fifty granular preference options", () => {
    expect(PREFERENCE_SCHEMA.length).toBeGreaterThan(50);
    expect(PREFERENCE_SCHEMA.map((definition) => definition.path)).toContain("advanced.searchHistoryLimit");
    expect(PREFERENCE_SCHEMA.map((definition) => definition.path)).toContain("advanced.syncConflictStrategy");
  });

  it("migrates older preferences into the current schema", () => {
    const migrated = migratePreferences({
      theme: "light",
      advanced: {
        dashboardColumns: 4,
      },
    });

    expect(migrated.schemaVersion).toBe(CURRENT_PREFERENCE_SCHEMA_VERSION);
    expect(migrated.theme).toBe("light");
    expect(migrated.advanced.dashboardColumns).toBe(4);
    expect(migrated.advanced.searchResultPageSize).toBe(20);
    expect(migrated.sync.conflictStrategy).toBe("newest");
  });

  it("validates enum, numeric, and boolean preference values", () => {
    const invalid = validatePreferences({
      advanced: {
        dashboardColumns: 99,
        maxConcurrentRequests: 99,
        reduceMotion: "no",
      },
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.errors.join(" ")).toContain("advanced.dashboardColumns");
    expect(invalid.errors.join(" ")).toContain("advanced.maxConcurrentRequests");
    expect(invalid.errors.join(" ")).toContain("advanced.reduceMotion");
  });

  it("applies built-in presets without dropping unrelated preferences", () => {
    const next = applyPreferencePreset("power-user", {
      ...DEFAULT_PREFERENCES,
      language: "es",
    });

    expect(next.language).toBe("es");
    expect(next.compactMode).toBe(true);
    expect(next.advanced.showRawXdr).toBe(true);
    expect(next.advanced.dashboardColumns).toBe(4);
  });

  it("exports and imports preferences as versioned JSON", () => {
    const exported = exportPreferences({
      ...DEFAULT_PREFERENCES,
      currency: "EUR",
      advanced: {
        ...DEFAULT_PREFERENCES.advanced,
        defaultExportFormat: "csv",
      },
    });
    const imported = importPreferences(exported);

    expect(imported.currency).toBe("EUR");
    expect(imported.advanced.defaultExportFormat).toBe("csv");
    expect(validatePreferences(imported).valid).toBe(true);
  });

  it("shares and imports custom presets", () => {
    const preset = createPreferencePreset("Desk setup", DEFAULT_PREFERENCES, { shared: true });
    const token = sharePreferencePreset(preset);
    const imported = importSharedPreferencePreset(token);

    expect(token).toEqual(expect.any(String));
    expect(imported.name).toBe("Desk setup");
    expect(imported.shared).toBe(true);
  });

  it("resolves sync conflicts and reports sync status", () => {
    const local = migratePreferences({
      ...DEFAULT_PREFERENCES,
      theme: "dark",
      sync: {
        ...DEFAULT_PREFERENCES.sync,
        lastSyncedAt: "2026-06-24T10:00:00.000Z",
        pendingChanges: 1,
      },
    });
    const remote = migratePreferences({
      ...DEFAULT_PREFERENCES,
      theme: "light",
      sync: {
        ...DEFAULT_PREFERENCES.sync,
        lastSyncedAt: "2026-06-24T11:00:00.000Z",
      },
    });

    const resolved = resolvePreferenceConflicts(local, remote, "newest");
    const status = getPreferenceSyncStatus(local);

    expect(resolved.preferences.theme).toBe("light");
    expect(resolved.conflicts).toContain("theme");
    expect(status.state).toBe("pending");
  });

  it("sets individual advanced preferences through schema paths", () => {
    const next = setAdvancedPreference(DEFAULT_PREFERENCES, "searchResultPageSize", 50);

    expect(next.advanced.searchResultPageSize).toBe(50);
  });
});
