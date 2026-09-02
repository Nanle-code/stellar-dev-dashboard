import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY, RTL_LANGUAGES } from '../i18n/index.js';
import {
    detectBestLocale,
    formatLocaleCurrency,
    formatLocaleDateTime,
    formatLocaleNumber,
    getCulturalAdaptations,
    getLocaleProfile,
    getRegionalContent,
    isLocaleRTL,
    loadPersistedLocale,
    persistLocalePreference,
    validateLocaleFormatting,
} from '../lib/localeFeatures';

const I18nContext = createContext(null);

function getInitialLocaleProfile() {
    return detectBestLocale({
        storedLocale: loadPersistedLocale(),
        navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : null,
        htmlLang: typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : null,
    });
}

function applyLocaleDocumentAttributes(profile) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('lang', profile.code);
    root.setAttribute('dir', profile.textDirection);
    root.dataset.locale = profile.code;
    root.dataset.region = profile.region;
    root.dataset.currency = profile.currency;
    root.dataset.layoutDensity = profile.layoutDensity;
}

/**
 * I18nProvider
 *
 * Wraps the app with i18next and exposes a language-switching API via context.
 * Must be rendered near the root of the component tree, before any component
 * that calls `useTranslation`.
 *
 * @example
 * <I18nProvider>
 *   <App />
 * </I18nProvider>
 */
export function I18nProvider({ children }) {
    const initialProfile = getInitialLocaleProfile();
    const [currentLanguage, setCurrentLanguage] = useState(
        () => i18n.language?.slice(0, 2) || initialProfile.languageCode
    );
    const [currentLocale, setCurrentLocale] = useState(
        () => initialProfile.code
    );

    // Keep local state in sync when i18next changes language externally
    useEffect(() => {
        const onLangChange = (lng) => {
            const profile = getLocaleProfile(lng);
            setCurrentLanguage(profile.languageCode);
            setCurrentLocale(profile.code);
            applyLocaleDocumentAttributes(profile);
        };
        i18n.on('languageChanged', onLangChange);
        return () => i18n.off('languageChanged', onLangChange);
    }, []);

    useEffect(() => {
        applyLocaleDocumentAttributes(getLocaleProfile(currentLocale));
    }, [currentLocale]);

    /**
     * Switch the active language.
     * @param {string} langCode - BCP-47 language code, e.g. 'en' | 'es'
     */
    const changeLanguage = useCallback(async (langCode) => {
        const requestedProfile = getLocaleProfile(langCode);
        const supported = SUPPORTED_LANGUAGES.find((l) => {
            return l.code === langCode || l.locale === langCode || l.code === requestedProfile.languageCode;
        });
        if (!supported) {
            console.warn(`[i18n] Unsupported language: "${langCode}". Falling back to "en".`);
        }

        const profile = getLocaleProfile(supported?.locale || 'en-US');
        await i18n.changeLanguage(profile.languageCode);
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, profile.languageCode);
        } catch {
            // localStorage may be unavailable (private browsing, etc.)
        }
        persistLocalePreference(profile.code);

        setCurrentLanguage(profile.languageCode);
        setCurrentLocale(profile.code);
        applyLocaleDocumentAttributes(profile);
    }, []);

    const localeProfile = getLocaleProfile(currentLocale);
    const isRTL = RTL_LANGUAGES.has(currentLanguage) || isLocaleRTL(currentLocale);
    const formatDateTime = useCallback(
        (date, options) => formatLocaleDateTime(date, currentLocale, options),
        [currentLocale]
    );
    const formatNumber = useCallback(
        (value, options) => formatLocaleNumber(value, currentLocale, options),
        [currentLocale]
    );
    const formatCurrency = useCallback(
        (value, currency) => formatLocaleCurrency(value, currentLocale, currency),
        [currentLocale]
    );
    const validateLocale = useCallback(
        () => validateLocaleFormatting(currentLocale),
        [currentLocale]
    );

    const value = {
        currentLanguage,
        currentLocale,
        changeLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
        localeProfile,
        culturalAdaptations: getCulturalAdaptations(currentLocale),
        regionalContent: getRegionalContent(currentLocale),
        formatDateTime,
        formatNumber,
        formatCurrency,
        validateLocale,
        isRTL,
    };

    return (
        <I18nextProvider i18n={i18n}>
            <I18nContext.Provider value={value}>
                {children}
            </I18nContext.Provider>
        </I18nextProvider>
    );
}

export function useI18nContext() {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error('useI18nContext must be used within <I18nProvider>');
    }
    return ctx;
}

export default I18nProvider;
