/**
 * useAITranslation — React hook for AI-powered dynamic translation
 *
 * Wraps the AI translation engine with React state so components can
 * translate arbitrary strings (e.g. user-generated content, API error
 * messages, contract names) beyond what static i18n key files cover.
 *
 * Usage:
 * ```tsx
 * const { aiTranslate, isTranslating, error } = useAITranslation();
 * const result = await aiTranslate('Your balance is low', 'es');
 * ```
 */

import { useCallback, useState } from 'react';
import { getTranslationEngine, type TranslationResult, type CommunityCorrection } from '../lib/aiTranslation';
import { useTranslation } from './useTranslation';

export interface UseAITranslationReturn {
  /** Translate a single string to the current UI language (or explicit targetLang). */
  aiTranslate: (
    text: string,
    targetLang?: string,
    context?: string,
  ) => Promise<TranslationResult | null>;

  /** Translate multiple strings at once. */
  aiTranslateBatch: (
    texts: string[],
    targetLang?: string,
    context?: string,
  ) => Promise<TranslationResult[]>;

  /** Submit a community correction for a mistranslation. */
  submitCorrection: (correction: CommunityCorrection) => void;

  /** True while a translation request is in flight. */
  isTranslating: boolean;

  /** Last error message, if any. */
  error: string | null;

  /** Cached translation result from the last aiTranslate call. */
  lastResult: TranslationResult | null;

  /** Engine statistics (TM size, API availability). */
  engineStats: { tmSize: number; hasMachineAPI: boolean };
}

export function useAITranslation(): UseAITranslationReturn {
  const { currentLanguage } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TranslationResult | null>(null);

  const engine = getTranslationEngine();

  const aiTranslate = useCallback(
    async (
      text: string,
      targetLang?: string,
      context?: string,
    ): Promise<TranslationResult | null> => {
      const lang = targetLang ?? currentLanguage;
      if (!text?.trim()) return null;

      setIsTranslating(true);
      setError(null);
      try {
        const result = await engine.translate({
          text,
          sourceLang: 'en',
          targetLang: lang,
          context,
        });
        setLastResult(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Translation failed';
        setError(msg);
        return null;
      } finally {
        setIsTranslating(false);
      }
    },
    [currentLanguage, engine],
  );

  const aiTranslateBatch = useCallback(
    async (
      texts: string[],
      targetLang?: string,
      context?: string,
    ): Promise<TranslationResult[]> => {
      const lang = targetLang ?? currentLanguage;
      if (!texts.length) return [];

      setIsTranslating(true);
      setError(null);
      try {
        const results = await engine.translateBatch(texts, lang, 'en', context);
        if (results.length > 0) setLastResult(results[results.length - 1]);
        return results;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Batch translation failed';
        setError(msg);
        return [];
      } finally {
        setIsTranslating(false);
      }
    },
    [currentLanguage, engine],
  );

  const submitCorrection = useCallback(
    (correction: CommunityCorrection): void => {
      engine.submitCorrection(correction);
    },
    [engine],
  );

  return {
    aiTranslate,
    aiTranslateBatch,
    submitCorrection,
    isTranslating,
    error,
    lastResult,
    engineStats: engine.getStats(),
  };
}

export default useAITranslation;
