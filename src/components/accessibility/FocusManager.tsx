import React, { useEffect, useRef } from 'react';

interface FocusManagerProps {
  children: React.ReactNode;
  trapFocus?: boolean;
  restoreFocusOnUnmount?: boolean;
  returnFocusElement?: string | HTMLElement | null;
}

export const FocusManager: React.FC<FocusManagerProps> = ({
  children,
  trapFocus = false,
  restoreFocusOnUnmount = false,
  returnFocusElement = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    previousActiveElement.current = document.activeElement;

    if (trapFocus) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return;

        const focusableElements = containerRef.current!.querySelectorAll<HTMLElement>(
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
          (previousActiveElement.current as HTMLElement).focus?.();
        }
      }
    };
  }, [restoreFocusOnUnmount, returnFocusElement]);

  return <div ref={containerRef}>{children}</div>;
};

export default FocusManager;
