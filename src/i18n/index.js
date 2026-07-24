import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./en.json";
import es from "./es.json";
import zh from "./zh.json";
import fr from "./fr.json";
import de from "./de.json";
import pt from "./pt.json";
import ja from "./ja.json";
import ko from "./ko.json";
import ar from "./ar.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", locale: "en-US", label: "English", nativeLabel: "English", dir: "ltr" },
  { code: "es", locale: "es-ES", label: "Spanish", nativeLabel: "Español", dir: "ltr" },
  { code: "zh", locale: "zh-CN", label: "Chinese", nativeLabel: "中文", dir: "ltr" },
  { code: "fr", locale: "fr-FR", label: "French", nativeLabel: "Français", dir: "ltr" },
  { code: "de", locale: "de-DE", label: "German", nativeLabel: "Deutsch", dir: "ltr" },
  { code: "pt", locale: "pt-BR", label: "Portuguese", nativeLabel: "Português", dir: "ltr" },
  { code: "ja", locale: "ja-JP", label: "Japanese", nativeLabel: "日本語", dir: "ltr" },
  { code: "ko", locale: "ko-KR", label: "Korean", nativeLabel: "한국어", dir: "ltr" },
  { code: "ar", locale: "ar-SA", label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
];

/** Languages that flow right-to-left (#107). */
export const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "stellar-dashboard-lang";

const resources = {
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  ja: { translation: ja },
  ko: { translation: ko },
  ar: { translation: ar },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: "translation",

    detection: {
      // Order of sources to detect language from
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },

    interpolation: {
      // React already handles XSS escaping
      escapeValue: false,
    },

    // Enable pluralization support (#107).
    // Keys with _one / _other suffixes are selected automatically.
    // Example: t('transactions.count', { count: 3 }) → "3 笔交易"
    pluralSeparator: "_",

    react: {
      // Wait for all translations to load before rendering
      useSuspense: false,
    },
  });

export default i18n;
