import { useEffect, useCallback } from 'react';
import { announceToScreenReader, setFocus, registerShortcut } from '../utils/accessibility';

/**
 * useAccessibility - React hook for accessibility features
 * Handles focus management, keyboard shortcuts, and screen reader announcements
 */
export const useAccessibility = (elementId = null) => {
  // Announce a message to screen readers
  const announce = useCallback((message, polite = false) => {
    announceToScreenReader(message, polite ? 'polite' : 'assertive');
  }, []);

  // Set focus to an element
  const setElementFocus = useCallback((target) => {
    if (typeof target === 'string') {
      setFocus(target);
    } else if (target instanceof HTMLElement) {
      target.focus();
    }
  }, []);

  // Register a keyboard shortcut
  const registerAccessibilityShortcut = useCallback((key, handler, options = {}) => {
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
