import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { setFocus } from '../utils/accessibility';
import { announceToScreenReader } from '../utils/accessibility';

const MAIN_CONTENT_ID = 'main-content';

/**
 * Moves keyboard focus to the main content region after route changes
 * so screen reader and keyboard users skip repetitive navigation.
 */
export function useRouteFocus(activeTab?: string) {
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname && !activeTab) return;

    previousPath.current = location.pathname;

    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;

    // Defer until lazy tab content has mounted
    const timer = window.setTimeout(() => {
      setFocus(MAIN_CONTENT_ID);
      const label = activeTab
        ? activeTab.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
        : 'page';
      announceToScreenReader(`Navigated to ${label}`);
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.pathname, activeTab]);
}

export default useRouteFocus;
