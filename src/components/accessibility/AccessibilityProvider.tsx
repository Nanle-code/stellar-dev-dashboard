import React from 'react';
import ScreenReaderAnnouncer from './ScreenReaderAnnouncer';

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export default function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  return (
    <>
      <ScreenReaderAnnouncer />
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        id="assertive-announcer"
        className="sr-only"
      />
      {children}
    </>
  );
}
