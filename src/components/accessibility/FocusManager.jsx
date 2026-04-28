import React, { useEffect, useRef } from 'react';

/**
 * FocusManager - Advanced focus management for keyboard navigation and accessibility
 * Handles focus trapping, focus restoration, and programmatic focus management
 */

export const FocusManager = ({
  children,
  trapFocus = false,
  restoreFocusOnUnmount = false,
  returnFocusElement = null,
}) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Store the previously focused element for restoration
    previousActiveElement.current = document.activeElement;

    if (trapFocus) {
      const handleKeyDown = (event) => {
        if (event.key !== 'Tab') return;

        const focusableElements = containerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      };

      containerRef.current.addEventListener('keydown', handleKeyDown);
      return () => containerRef.current?.removeEventListener('keydown', handleKeyDown);
    }
  }, [trapFocus]);

  useEffect(() => {
    return () => {
      if (restoreFocusOnUnmount && previousActiveElement.current) {
        if (returnFocusElement && typeof returnFocusElement === 'string') {
          document.getElementById(returnFocusElement)?.focus();
        } else if (returnFocusElement instanceof HTMLElement) {
          returnFocusElement.focus();
        } else {
          previousActiveElement.current.focus();
        }
      }
    };
  }, [restoreFocusOnUnmount, returnFocusElement]);

  return <div ref={containerRef}>{children}</div>;
};

export default FocusManager;
