import React from 'react';
import ScreenReaderAnnouncer from './ScreenReaderAnnouncer';

/**
 * Wraps the app with all accessibility providers and global helpers.
 */
export default function AccessibilityProvider({ children }) {
  return (
    <>
      {/* Live region for screen reader announcements */}
      <ScreenReaderAnnouncer />

      {/* assertive region for errors/urgent messages */}
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
