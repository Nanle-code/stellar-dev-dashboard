import { useEffect, useCallback } from 'react';
import { announceToScreenReader, setFocus, registerShortcut } from '../utils/accessibility';

export interface UseAccessibilityReturn {
  announce: (message: string, polite?: boolean) => void;
  setFocus: (target: string | HTMLElement) => void;
  registerShortcut: (key: string, handler: () => void, options?: Record<string, unknown>) => () => void;
}

export const useAccessibility = (elementId: string | null = null): UseAccessibilityReturn => {
  const announce = useCallback((message: string, polite = false) => {
    announceToScreenReader(message, polite ? 'polite' : 'assertive');
  }, []);

  const setElementFocus = useCallback((target: string | HTMLElement) => {
    if (typeof target === 'string') {
      setFocus(target);
    } else {
      target.focus();
    }
  }, []);

  const registerAccessibilityShortcut = useCallback(
    (key: string, handler: () => void, options: Record<string, unknown> = {}) => {
      return registerShortcut(key, handler, { ...options, category: 'accessibility' });
    },
    [],
  );

  useEffect(() => {
    if (elementId) {
      const timer = setTimeout(() => setFocus(elementId), 0);
      return () => clearTimeout(timer);
    }
  }, [elementId]);

  return {
    announce,
    setFocus: setElementFocus,
    registerShortcut: registerAccessibilityShortcut,
  };
};

export default useAccessibility;
