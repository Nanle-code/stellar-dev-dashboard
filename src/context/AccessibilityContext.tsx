import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import ScreenReaderAnnouncer from '../components/accessibility/ScreenReaderAnnouncer';
import {
  createDefaultAccessibilityProfile,
  learnAccessibilityPreferences,
  type AccessibilityFeedback,
  type AccessibilityInteractionSignal,
  type AccessibilityPreferenceSettings,
  type AccessibilityRecommendation,
} from '../lib/accessibilityAdaptive';

export type AccessibilitySettings = AccessibilityPreferenceSettings;

const defaultSettings: AccessibilitySettings = {
  reducedMotion: false,
  highContrast: false,
  fontSize: 'default',
  dyslexiaFont: false,
  adaptiveMode: true,
};

const AccessibilityContext = createContext<{
  settings: AccessibilitySettings;
  recommendations: AccessibilityRecommendation[];
  confidence: number;
  setReducedMotion: (_v: boolean) => void;
  setHighContrast: (_v: boolean) => void;
  setFontSize: (_v: AccessibilitySettings['fontSize']) => void;
  setDyslexiaFont: (_v: boolean) => void;
  setAdaptiveMode: (_v: boolean) => void;
  applyRecommendations: () => void;
}>({
  settings: defaultSettings,
  recommendations: [],
  confidence: 0.5,
  setReducedMotion: () => {},
  setHighContrast: () => {},
  setFontSize: () => {},
  setDyslexiaFont: () => {},
  setAdaptiveMode: () => {},
  applyRecommendations: () => {},
});

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    try {
      const stored = window.localStorage.getItem('accessibility');
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AccessibilitySettings>;
        return { ...defaultSettings, ...parsed };
      }
    } catch {
      // Fall back to defaults when localStorage is unavailable.
    }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { ...defaultSettings, reducedMotion: prefersReduced };
  });
  const [, setProfile] = useState(() => createDefaultAccessibilityProfile({ ...defaultSettings, ...settings }));
  const [recommendations, setRecommendations] = useState<AccessibilityRecommendation[]>([]);
  const [confidence, setConfidence] = useState(0.5);
  const interactionBufferRef = useRef<AccessibilityInteractionSignal[]>([]);
  const feedbackBufferRef = useRef<AccessibilityFeedback[]>([]);

  const applySettingsToDom = useCallback((nextSettings: AccessibilitySettings) => {
    const html = document.documentElement;
    if (nextSettings.reducedMotion) {
      html.setAttribute('data-reduced-motion', 'true');
    } else {
      html.removeAttribute('data-reduced-motion');
    }
    if (nextSettings.highContrast) {
      html.setAttribute('data-high-contrast', 'true');
    } else {
      html.removeAttribute('data-high-contrast');
    }
    let scale = '1';
    if (nextSettings.fontSize === 'small') scale = '0.875';
    else if (nextSettings.fontSize === 'large') scale = '1.15';
    html.style.setProperty('--font-scale', scale);
    if (nextSettings.dyslexiaFont) {
      html.style.setProperty('--font-family', 'OpenDyslexic, Arial, sans-serif');
    } else {
      html.style.removeProperty('--font-family');
    }
  }, []);

  const recordFeedback = useCallback((feedback: AccessibilityFeedback) => {
    feedbackBufferRef.current = [...feedbackBufferRef.current, feedback].slice(-6);
    setProfile((current) => {
      const nextProfile = learnAccessibilityPreferences(current, interactionBufferRef.current, [feedback]);
      setRecommendations(nextProfile.recommendations);
      setConfidence(nextProfile.confidence);
      return nextProfile;
    });
  }, []);

  const recordInteraction = useCallback((signal: AccessibilityInteractionSignal) => {
    interactionBufferRef.current = [...interactionBufferRef.current, signal].slice(-6);
    setProfile((current) => {
      const nextProfile = learnAccessibilityPreferences(current, [signal], feedbackBufferRef.current);
      setRecommendations(nextProfile.recommendations);
      setConfidence(nextProfile.confidence);
      return nextProfile;
    });
  }, []);

  const applyRecommendations = useCallback(() => {
    setSettings((current) => {
      const nextSettings = { ...current };
      recommendations.forEach((recommendation) => {
        if (recommendation.key === 'reducedMotion' && typeof recommendation.value === 'boolean') {
          nextSettings.reducedMotion = recommendation.value;
        }
        if (recommendation.key === 'highContrast' && typeof recommendation.value === 'boolean') {
          nextSettings.highContrast = recommendation.value;
        }
        if (recommendation.key === 'fontSize' && (recommendation.value === 'small' || recommendation.value === 'default' || recommendation.value === 'large')) {
          nextSettings.fontSize = recommendation.value;
        }
        if (recommendation.key === 'dyslexiaFont' && typeof recommendation.value === 'boolean') {
          nextSettings.dyslexiaFont = recommendation.value;
        }
        if (recommendation.key === 'adaptiveMode' && typeof recommendation.value === 'boolean') {
          nextSettings.adaptiveMode = recommendation.value;
        }
      });
      applySettingsToDom(nextSettings);
      return nextSettings;
    });
  }, [applySettingsToDom, recommendations]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('accessibility', JSON.stringify(settings));
    applySettingsToDom(settings);
  }, [applySettingsToDom, settings]);

  useEffect(() => {
    if (!settings.adaptiveMode || recommendations.length === 0 || confidence < 0.72) return;
    applyRecommendations();
  }, [applyRecommendations, confidence, recommendations, settings.adaptiveMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyboard = () => recordInteraction({ type: 'keyboard', value: 0.8 });
    const handleFocus = () => recordInteraction({ type: 'focus', value: 0.55 });
    const handleError = () => recordInteraction({ type: 'error', value: 0.75 });
    const timer = window.setTimeout(() => recordInteraction({ type: 'long-session', value: 0.7 }), 300000);

    window.addEventListener('keydown', handleKeyboard);
    document.addEventListener('focusin', handleFocus);
    window.addEventListener('error', handleError);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyboard);
      document.removeEventListener('focusin', handleFocus);
      window.removeEventListener('error', handleError);
    };
  }, [recordInteraction]);

  const setReducedMotion = (v: boolean) => {
    setSettings((current) => ({ ...current, reducedMotion: v }));
    recordFeedback({ type: 'explicit', preference: { reducedMotion: v }, strength: 0.9 });
  };

  const setHighContrast = (v: boolean) => {
    setSettings((current) => ({ ...current, highContrast: v }));
    recordFeedback({ type: 'explicit', preference: { highContrast: v }, strength: 0.9 });
  };

  const setFontSize = (v: AccessibilitySettings['fontSize']) => {
    setSettings((current) => ({ ...current, fontSize: v }));
    recordFeedback({ type: 'explicit', preference: { fontSize: v }, strength: 0.85 });
  };

  const setDyslexiaFont = (v: boolean) => {
    setSettings((current) => ({ ...current, dyslexiaFont: v }));
    recordFeedback({ type: 'explicit', preference: { dyslexiaFont: v }, strength: 0.85 });
  };

  const setAdaptiveMode = (v: boolean) => {
    setSettings((current) => ({ ...current, adaptiveMode: v }));
    recordFeedback({ type: 'explicit', preference: { adaptiveMode: v }, strength: 0.8 });
  };

  return (
    <AccessibilityContext.Provider value={{ settings, recommendations, confidence, setReducedMotion, setHighContrast, setFontSize, setDyslexiaFont, setAdaptiveMode, applyRecommendations }}>
      <ScreenReaderAnnouncer />
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        id="assertive-announcer"
        className="sr-only"
      />
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
