/**
 * routeComponents.ts — lazy component resolution for the route registry.
 *
 * `routes.ts` stays framework-agnostic; this module owns the React.lazy cache
 * so components are created once per route id.
 */

import { lazy } from 'react';
import { ROUTES_BY_ID, type TabComponent } from './routes';

const componentCache = new Map<string, TabComponent>();

/** Lazily resolve (and memoize) the component for a route id. */
export function getRouteComponent(id: string): TabComponent | null {
  const route = ROUTES_BY_ID[id];
  if (!route) return null;

  let component = componentCache.get(id);
  if (!component) {
    component = lazy(route.loader) as unknown as TabComponent;
    componentCache.set(id, component);
  }
  return component;
}

/** Test-only reset so module state cannot leak between suites. */
export function resetRouteComponentCache(): void {
  componentCache.clear();
}
