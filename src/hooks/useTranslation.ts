import { useCallback } from "react";
import { useTranslation as useI18nextTranslation } from "react-i18next";
import { useI18nContext } from "../components/I18nProvider.jsx";
import { RTL_LANGUAGES } from "../i18n/index.js";

export interface SupportedLanguage {
  code: string;
  label: string;
  nativeLabel: string;
}

export interface UseTranslationReturn {
  t: (key: string, options?: Record<string, unknown>) => string;
  tPlural: (key: string, count: number, extra?: Record<string, unknown>) => string;
  formatNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
  i18n: ReturnType<typeof useI18nextTranslation>['i18n'];
  ready: boolean;
  currentLanguage: string;
  currentLocale: string;
  changeLanguage: (code: string) => Promise<void>;
  supportedLanguages: SupportedLanguage[];
  localeProfile: unknown;
  culturalAdaptations: unknown;
  regionalContent: unknown;
  formatCurrency: (value: number, currency?: string) => string;
  validateLocale: () => unknown;
  isRTL: boolean;
}

/**
 * useTranslation
 *
 * A thin wrapper around react-i18next's `useTranslation` that also exposes
 * the language-switching helpers from `I18nProvider`.
 *
 * Usage:
 * ```jsx
 * const { t, currentLanguage, changeLanguage, supportedLanguages } = useTranslation();
 *
 * // Translate a key
 * t('common.loading')                      // → "Loading..."
 *
 * // Interpolation
 * t('connect.successMessage', { address }) // → "Successfully connected to G..."
 *
 * // Namespace (defaults to 'translation')
 * t('nav.overview')                        // → "Overview"
 *
 * // Switch language
 * changeLanguage('es')
 * ```
 *
 * @param ns - Optional i18next namespace override
 * @returns Translation helpers and language-switching API
 */
export function useTranslation(ns: string = "translation"): UseTranslationReturn {
  const { t, i18n, ready } = useI18nextTranslation(ns);
  const {
    currentLanguage,
    currentLocale,
    changeLanguage,
    supportedLanguages,
    localeProfile,
    culturalAdaptations,
    regionalContent,
    formatDateTime,
    formatNumber: formatLocaleNumber,
    formatCurrency,
    validateLocale,
    isRTL,
  } = useI18nContext();

  /**
   * Safe translate — returns the key itself when a translation is missing,
   * which prevents blank UI during hot reloads or missing keys in dev.
   */
  const safeT = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      const result = t(key, options);
      return result ?? key;
    },
    [t],
  );

  /**
   * Pluralize helper (#107).
   * Delegates to i18next count interpolation:
   *   tPlural('transactions.count', 3) → uses key 'transactions.count_one' or 'transactions.count_other'
   *
   * @param key - Translation key
   * @param count - Plural count
   * @param extra - Additional interpolation values
   */
  const tPlural = useCallback(
    (key: string, count: number, extra: Record<string, unknown> = {}): string => safeT(key, { count, ...extra }),
    [safeT],
  );

  /**
   * Format a number according to the current locale (#107).
   * @param value - Numeric value to format
   * @param opts - Intl.NumberFormat options
   */
  const formatNumber = useCallback(
    (value: number, opts: Intl.NumberFormatOptions = {}): string => {
      try {
        return formatLocaleNumber(value, opts);
      } catch {
        return String(value);
      }
    },
    [formatLocaleNumber],
  );

  /**
   * Format a date according to the current locale (#107).
   * @param date - Date value to format
   * @param opts - Intl.DateTimeFormat options
   */
  const formatDate = useCallback(
    (date: Date | string | number, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string => {
      try {
        return formatDateTime(date, opts);
      } catch {
        return String(date);
      }
    },
    [formatDateTime],
  );

  /** true if the active language is RTL (#107) */
  const isRTLActive = isRTL || RTL_LANGUAGES.has(currentLanguage);

  return {
    t: safeT,
    tPlural,
    formatNumber,
    formatDate,
    i18n,
    ready,
    currentLanguage,
    currentLocale,
    changeLanguage,
    supportedLanguages,
    localeProfile,
    culturalAdaptations,
    regionalContent,
    formatCurrency,
    validateLocale,
    isRTL: isRTLActive,
  };
}

export default useTranslation;
