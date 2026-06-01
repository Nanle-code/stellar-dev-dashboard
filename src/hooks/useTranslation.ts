import { useCallback } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import { useI18nContext } from '../components/I18nProvider.jsx';
import { RTL_LANGUAGES } from '../i18n/index.js';

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
  i18n: unknown;
  ready: boolean;
  currentLanguage: string;
  changeLanguage: (code: string) => Promise<void>;
  supportedLanguages: SupportedLanguage[];
  isRTL: boolean;
}

export function useTranslation(ns = 'translation'): UseTranslationReturn {
  const { t, i18n, ready } = useI18nextTranslation(ns);
  const { currentLanguage, changeLanguage, supportedLanguages, isRTL } = useI18nContext();

  const safeT = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      const result = t(key, options);
      return result ?? key;
    },
    [t],
  );

  const tPlural = useCallback(
    (key: string, count: number, extra: Record<string, unknown> = {}): string =>
      safeT(key, { count, ...extra }),
    [safeT],
  );

  const formatNumber = useCallback(
    (value: number, opts: Intl.NumberFormatOptions = {}): string => {
      try {
        return new Intl.NumberFormat(currentLanguage, opts).format(value);
      } catch {
        return String(value);
      }
    },
    [currentLanguage],
  );

  const formatDate = useCallback(
    (date: Date | string | number, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string => {
      try {
        return new Intl.DateTimeFormat(currentLanguage, opts).format(new Date(date));
      } catch {
        return String(date);
      }
    },
    [currentLanguage],
  );

  const isRTLActive = isRTL || RTL_LANGUAGES.has(currentLanguage);

  return { t: safeT, tPlural, formatNumber, formatDate, i18n, ready, currentLanguage, changeLanguage, supportedLanguages, isRTL: isRTLActive };
}

export default useTranslation;
