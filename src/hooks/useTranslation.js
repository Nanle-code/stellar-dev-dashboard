import { useCallback } from "react";
import { useTranslation as useI18nextTranslation } from "react-i18next";
import { useI18nContext } from "../components/I18nProvider.jsx";

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
 * @param {string} [ns='translation'] - Optional i18next namespace override
 * @returns {{
 *   t: import('i18next').TFunction,
 *   i18n: import('i18next').i18n,
 *   currentLanguage: string,
 *   changeLanguage: (code: string) => Promise<void>,
 *   supportedLanguages: Array<{ code: string, label: string, nativeLabel: string }>,
 *   isRTL: boolean,
 *   ready: boolean,
 * }}
 */
export function useTranslation(ns = "translation") {
  const { t, i18n, ready } = useI18nextTranslation(ns);
  const { currentLanguage, changeLanguage, supportedLanguages, isRTL } =
    useI18nContext();

  /**
   * Safe translate — returns the key itself when a translation is missing,
   * which prevents blank UI during hot reloads or missing keys in dev.
   */
  const safeT = useCallback(
    (key, options) => {
      const result = t(key, options);
      return result ?? key;
    },
    [t],
  );

  return {
    t: safeT,
    i18n,
    ready,
    currentLanguage,
    changeLanguage,
    supportedLanguages,
    isRTL,
  };
}

export default useTranslation;
