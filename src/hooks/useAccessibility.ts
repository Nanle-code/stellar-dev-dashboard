import { useEffect, useCallback } from 'react';
import { announceToScreenReader, setFocus, registerShortcut } from '../utils/accessibility';

/**
 * useAccessibility - React hook for accessibility features
 * Handles focus management, keyboard shortcuts, and screen reader announcements
 */

/** Options for registering an accessibility keyboard shortcut. */
export interface UseAccessibilityShortcutOptions {
  description?: string;
  category?: string;
  id?: string;
  [key: string]: unknown;
}

/** Return value of the {@link useAccessibility} hook. */
export interface UseAccessibilityReturn {
  announce: (message: string, polite?: boolean) => void;
  setFocus: (target: string | HTMLElement) => void;
  registerShortcut: (
    key: string,
    handler: (event: KeyboardEvent) => void,
    options?: UseAccessibilityShortcutOptions
  ) => () => void;
}

export const useAccessibility = (elementId: string | null = null): UseAccessibilityReturn => {
  // Announce a message to screen readers
  const announce = useCallback((message: string, polite = false): void => {
    announceToScreenReader(message, polite ? 'polite' : 'assertive');
  }, []);

  // Set focus to an element
  const setElementFocus = useCallback((target: string | HTMLElement): void => {
    if (typeof target === 'string') {
      setFocus(target);
    } else if (target instanceof HTMLElement) {
      target.focus();
    }
  }, []);

  // Register a keyboard shortcut
  const registerAccessibilityShortcut = useCallback((key: string, handler: (event: KeyboardEvent) => void, options: UseAccessibilityShortcutOptions = {}): (() => void) => {
    return registerShortcut(key, handler, {
      ...options,
      category: 'accessibility'
    });
  }, []);

  // Auto-focus element on mount if elementId provided
  useEffect(() => {
    if (elementId) {
      const timer = setTimeout(() => setFocus(elementId), 0);
      return () => clearTimeout(timer);
    }
  }, [elementId]);

  return {
    announce,
    setFocus: setElementFocus,
    registerShortcut: registerAccessibilityShortcut
  };
};

export default useAccessibility;
