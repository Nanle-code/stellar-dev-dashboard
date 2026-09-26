/**
 * usePreload — prefetch a lazy-loaded view chunk when the user hovers over its
 * sidebar/nav link. Loaders now come from the single route registry (#959)
 * rather than a parallel map that could drift out of sync.
 *
 * Usage:
 *   const { preload } = usePreload()
 *   <button onMouseEnter={() => preload('overview')} />
 */

import { ROUTES_BY_ID } from '../routes/routes';

const preloaded = new Set<string>();

/** Trigger the dynamic import for a route so the browser fetches the chunk early. */
export function preloadTab(tab: string): void {
  if (preloaded.has(tab)) return;
  const route = ROUTES_BY_ID[tab];
  if (!route) return;
  preloaded.add(tab);
  route.loader().catch(() => {
    // Non-fatal — chunk will still load when the user navigates
    preloaded.delete(tab);
  });
}

export interface UsePreloadReturn {
  preload: (tab: string) => void;
}

/** Hook that returns a stable `preload` callback for use in event handlers. */
export function usePreload(): UsePreloadReturn {
  return { preload: preloadTab };
}
