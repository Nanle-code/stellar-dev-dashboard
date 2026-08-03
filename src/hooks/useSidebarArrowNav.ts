import { useEffect, useRef } from 'react';

/**
 * Enables ArrowUp/ArrowDown keyboard navigation within a sidebar nav list.
 */
export function useSidebarArrowNav(navRef: React.RefObject<HTMLElement>, enabled = true) {
  const itemSelector = 'nav[aria-label="Dashboard sections"] button:not([disabled])';

  useEffect(() => {
    if (!enabled || !navRef.current) return;

    const nav = navRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') {
        return;
      }

      const items = Array.from(nav.querySelectorAll<HTMLButtonElement>(itemSelector));
      if (items.length === 0) return;

      const active = document.activeElement as HTMLButtonElement | null;
      const currentIndex = active ? items.indexOf(active) : -1;

      if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
        return;
      }

      e.preventDefault();

      let nextIndex: number;
      if (e.key === 'ArrowDown') {
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }

      items[nextIndex]?.focus();
    };

    nav.addEventListener('keydown', handleKeyDown);
    return () => nav.removeEventListener('keydown', handleKeyDown);
  }, [enabled, navRef]);
}

export default useSidebarArrowNav;
