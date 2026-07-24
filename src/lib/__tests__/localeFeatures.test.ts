import { describe, expect, it } from "vitest";
import {
  buildLocaleTestMatrix,
  detectBestLocale,
  formatLocaleCurrency,
  formatLocaleDateTime,
  formatLocaleNumber,
  getCulturalAdaptations,
  getLocaleProfile,
  getRegionalContent,
  isLocaleRTL,
  loadPersistedLocale,
  LOCALE_PROFILES,
  LOCALE_STORAGE_KEY,
  normalizeLocaleCode,
  persistLocalePreference,
  validateLocaleFormatting,
} from "../localeFeatures";

describe("locale features", () => {
  it("normalizes full locale codes and language-only codes", () => {
    expect(normalizeLocaleCode("es-MX")).toBe("es-ES");
    expect(normalizeLocaleCode("pt")).toBe("pt-BR");
    expect(normalizeLocaleCode("unknown")).toBe("en-US");
  });

  it("detects locale from stored value before browser hints", () => {
    expect(
      detectBestLocale({
        storedLocale: "ar-SA",
        navigatorLanguage: "de-DE",
        htmlLang: "fr-FR",
      }).code,
    ).toBe("ar-SA");
  });

  it("persists and reloads locale preferences with a storage adapter", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    const profile = persistLocalePreference("fr", storage);

    expect(profile.code).toBe("fr-FR");
    expect(values.get(LOCALE_STORAGE_KEY)).toBe("fr-FR");
    expect(loadPersistedLocale(storage)).toBe("fr-FR");
  });

  it("formats date, number, and currency with the locale profile", () => {
    expect(formatLocaleDateTime("2026-06-25T15:30:00Z", "en-US")).toContain("2026");
    expect(formatLocaleNumber(1234567.89, "de-DE")).toContain(".");
    expect(formatLocaleCurrency(1234.56, "ja-JP")).toMatch(/[¥￥]/);
  });

  it("exposes cultural adaptations and regional content", () => {
    expect(getCulturalAdaptations("ar-SA").textDirection).toBe("rtl");
    expect(getRegionalContent("pt-BR").marketLabel).toContain("Brasil");
    expect(getLocaleProfile("ko").currency).toBe("KRW");
  });

  it("validates RTL and formatting coverage across all profiles", () => {
    expect(isLocaleRTL("ar-SA")).toBe(true);
    expect(isLocaleRTL("en-US")).toBe(false);
    expect(validateLocaleFormatting("ar-SA").directionMatches).toBe(true);

    const matrix = buildLocaleTestMatrix();
    expect(matrix).toHaveLength(LOCALE_PROFILES.length);
    expect(matrix.every((entry) => entry.valid)).toBe(true);
  });
});
