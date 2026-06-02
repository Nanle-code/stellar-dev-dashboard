import React, { createContext, useContext, useEffect, useState } from 'react';

export type AccessibilitySettings = {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'default' | 'large';
};

const defaultSettings: AccessibilitySettings = {
  reducedMotion: false,
  highContrast: false,
  fontSize: 'default',
};

const AccessibilityContext = createContext<{
  settings: AccessibilitySettings;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setFontSize: (v: AccessibilitySettings['fontSize']) => void;
}>({
  settings: defaultSettings,
  setReducedMotion: () => {},
  setHighContrast: () => {},
  setFontSize: () => {},
});

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const stored = localStorage.getItem('accessibility');
      if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
    } catch (_) {}
    // Respect OS setting for reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { ...defaultSettings, reducedMotion: prefersReduced };
  });

  // Persist to localStorage and apply CSS variables / attributes
  useEffect(() => {
    localStorage.setItem('accessibility', JSON.stringify(settings));
    const html = document.documentElement;
    if (settings.reducedMotion) {
      html.setAttribute('data-reduced-motion', 'true');
    } else {
      html.removeAttribute('data-reduced-motion');
    }
    if (settings.highContrast) {
      html.setAttribute('data-high-contrast', 'true');
    } else {
      html.removeAttribute('data-high-contrast');
    }
    // Font scaling via CSS variable
    let scale = '1';
    if (settings.fontSize === 'small') scale = '0.875';
    else if (settings.fontSize === 'large') scale = '1.15';
    html.style.setProperty('--font-scale', scale);
  }, [settings]);

  const setReducedMotion = (v: boolean) => setSettings((s) => ({ ...s, reducedMotion: v }));
  const setHighContrast = (v: boolean) => setSettings((s) => ({ ...s, highContrast: v }));
  const setFontSize = (v: AccessibilitySettings['fontSize']) => setSettings((s) => ({ ...s, fontSize: v }));

  return (
    <AccessibilityContext.Provider value={{ settings, setReducedMotion, setHighContrast, setFontSize }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
