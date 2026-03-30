import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY } from '../i18n/index.js';

const I18nContext = createContext(null);


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
    const [currentLanguage, setCurrentLanguage] = useState(
        () => i18n.language?.slice(0, 2) || 'en'
    );

    // Keep local state in sync when i18next changes language externally
    useEffect(() => {
        const onLangChange = (lng) => setCurrentLanguage(lng.slice(0, 2));
        i18n.on('languageChanged', onLangChange);
        return () => i18n.off('languageChanged', onLangChange);
    }, []);

    /**
     * Switch the active language.
     * @param {string} langCode - BCP-47 language code, e.g. 'en' | 'es'
     */
    const changeLanguage = useCallback(async (langCode) => {
        const supported = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
        if (!supported) {
            console.warn(`[i18n] Unsupported language: "${langCode}". Falling back to "en".`);
            langCode = 'en';
        }

        await i18n.changeLanguage(langCode);
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
        } catch {
            // localStorage may be unavailable (private browsing, etc.)
        }

        // Update <html lang=""> for accessibility & SEO
        document.documentElement.setAttribute('lang', langCode);
    }, []);

    const value = {
        currentLanguage,
        changeLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
        isRTL: false, // extend here when adding RTL languages (e.g. 'ar')
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