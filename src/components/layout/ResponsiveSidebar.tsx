/**
 * ResponsiveSidebar — wraps Sidebar with responsive show/hide logic.
 * On mobile: renders as a slide-in drawer controlled by isMobileMenuOpen.
 * On desktop: renders as a fixed sidebar.
 */
import React from 'react';
import { useStore } from '../../lib/store';
import { useResponsive } from '../../hooks/useResponsive';
import Sidebar from './Sidebar';

export default function ResponsiveSidebar() {
  const { isMobileMenuOpen, setMobileMenuOpen } = useStore();
  const { isMobile } = useResponsive() as { isMobile: boolean };

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && (
        <div
          className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar isMobile={isMobile} />
    </>
  );
}