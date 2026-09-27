import { describe, it, expect, beforeEach } from 'vitest';
import {
  APP_TITLE_SUFFIX,
  GROUP_LABELS,
  ROUTES,
  ROUTES_BY_ID,
  buildPath,
  getDocumentTitle,
  getMobileNavRoutes,
  getNavGroups,
  getNavRoutes,
  getRouteById,
  isRouteVisible,
  matchRoute,
} from '../../../src/routes/routes';
import {
  getRouteComponent,
  resetRouteComponentCache,
} from '../../../src/routes/routeComponents';

describe('route registry (#959)', () => {
  describe('registry integrity (primary flow)', () => {
    it('declares the required metadata for every view', () => {
      expect(ROUTES.length).toBeGreaterThan(30);
      for (const route of ROUTES) {
        expect(typeof route.id).toBe('string');
        expect(route.id.length).toBeGreaterThan(0);
        expect(route.path.startsWith('/')).toBe(true);
        expect(route.title.length).toBeGreaterThan(0);
        expect(route.icon.length).toBeGreaterThan(0);
        expect(Object.keys(GROUP_LABELS)).toContain(route.group);
        expect(typeof route.loader).toBe('function');
      }
    });

    it('uses unique ids and unique path templates', () => {
      const ids = ROUTES.map((route) => route.id);
      expect(new Set(ids).size).toBe(ids.length);

      const paths = ROUTES.map((route) => route.path);
      expect(new Set(paths).size).toBe(paths.length);
    });

    it('resolves every registry route from its own generated path', () => {
      for (const route of ROUTES) {
        const match = matchRoute(buildPath(route.id));
        expect(match?.route.id, `path for ${route.id}`).toBe(route.id);
      }
    });

    it('indexes routes by id', () => {
      expect(getRouteById('overview')).toBe(ROUTES_BY_ID.overview);
    });
  });

  describe('path building', () => {
    it('builds static paths', () => {
      expect(buildPath('overview')).toBe('/overview');
      expect(buildPath('settings')).toBe('/settings');
    });

    it('substitutes entity params', () => {
      expect(buildPath('account', { address: 'GABC123' })).toBe('/account/GABC123');
      expect(buildPath('transactions', { hash: 'abc' })).toBe('/transactions/abc');
    });

    it('omits optional params the caller did not supply', () => {
      expect(buildPath('account')).toBe('/account');
      expect(buildPath('account', { address: undefined })).toBe('/account');
    });

    it('percent-encodes entity params', () => {
      expect(buildPath('account', { address: 'G ABC' })).toBe('/account/G%20ABC');
    });

    it('falls back to "/" for an unknown id', () => {
      expect(buildPath('not-a-real-route')).toBe('/');
    });
  });

  describe('matching', () => {
    it('matches static routes', () => {
      expect(matchRoute('/overview')?.route.id).toBe('overview');
      expect(matchRoute('/settings')?.route.id).toBe('settings');
    });

    it('matches the overview alias for "/"', () => {
      expect(matchRoute('/')?.route.id).toBe('overview');
    });

    it('extracts entity path params', () => {
      const account = matchRoute('/account/GABC123');
      expect(account?.params.address).toBe('GABC123');

      const tx = matchRoute('/transactions/hash-1');
      expect(tx?.route.id).toBe('transactions');
      expect(tx?.params.hash).toBe('hash-1');
    });

    it('decodes percent-encoded path params', () => {
      expect(matchRoute('/account/G%20ABC')?.params.address).toBe('G ABC');
    });

    it('tolerates malformed percent-encoding instead of throwing', () => {
      expect(() => matchRoute('/account/%E0%A4%A')).not.toThrow();
      expect(matchRoute('/account/%E0%A4%A')?.params.address).toBe('%E0%A4%A');
    });

    it('ignores query strings and trailing slashes', () => {
      expect(matchRoute('/overview?ref=sidebar')?.route.id).toBe('overview');
      expect(matchRoute('/settings/')?.route.id).toBe('settings');
    });

    it('leaves optional params unset when absent', () => {
      const match = matchRoute('/transactions');
      expect(match?.route.id).toBe('transactions');
      expect(match?.params.hash).toBeUndefined();
    });
  });

  describe('failure cases', () => {
    it('returns null for unknown paths (404 handling)', () => {
      expect(matchRoute('/definitely-not-a-view')).toBeNull();
      expect(matchRoute('/account/one/two')).toBeNull();
    });

    it('returns a 404 document title when no route matches', () => {
      expect(getDocumentTitle(null)).toBe(`Page not found · ${APP_TITLE_SUFFIX}`);
      expect(getDocumentTitle(undefined)).toBe(`Page not found · ${APP_TITLE_SUFFIX}`);
    });

    it('returns undefined / null lookups for unknown ids', () => {
      expect(getRouteById('missing')).toBeUndefined();
      expect(getRouteComponent('missing')).toBeNull();
    });
  });

  describe('derived navigation', () => {
    it('excludes routes marked nav:false from the sidebar', () => {
      const navIds = getNavRoutes().map((route) => route.id);
      expect(navIds).not.toContain('compliance');
      expect(navIds).not.toContain('devToolbar');
      expect(navIds).toContain('overview');
    });

    it('groups nav routes under labelled group headers', () => {
      const groups = getNavGroups();
      expect(groups[0]?.label).toBe(GROUP_LABELS.analytics);
      for (const group of groups) {
        expect(group.routes.length).toBeGreaterThan(0);
        for (const route of group.routes) {
          expect(route.group).toBe(group.group);
          expect(route.nav).not.toBe(false);
        }
      }
    });

    it('resolves the mobile drawer subset from the registry', () => {
      const mobile = getMobileNavRoutes();
      expect(mobile.length).toBeGreaterThan(0);
      expect(mobile.map((route) => route.id)).toContain('overview');
      for (const route of mobile) {
        expect(ROUTES_BY_ID[route.id]).toBe(route);
      }
    });
  });

  describe('progressive disclosure', () => {
    it('hides expert routes from novices', () => {
      const compliance = getRouteById('compliance')!;
      expect(isRouteVisible(compliance, { expertiseLevel: 'novice' })).toBe(false);
      expect(isRouteVisible(compliance, { expertiseLevel: 'intermediate' })).toBe(false);
      expect(isRouteVisible(compliance, { expertiseLevel: 'expert' })).toBe(true);
    });

    it('honours feature-flag resolvers', () => {
      const devToolbar = getRouteById('devToolbar')!;
      expect(isRouteVisible(devToolbar, { isFeatureEnabled: () => false })).toBe(false);
      expect(isRouteVisible(devToolbar, { isFeatureEnabled: () => true })).toBe(true);
      // Without a resolver the route stays visible (default on).
      expect(isRouteVisible(devToolbar)).toBe(true);
    });

    it('leaves unflagged routes visible', () => {
      expect(isRouteVisible(getRouteById('overview')!, { expertiseLevel: 'novice' })).toBe(true);
    });
  });

  describe('document titles', () => {
    it('prefixes the route title with the app suffix', () => {
      expect(getDocumentTitle(getRouteById('overview'))).toBe(`Overview · ${APP_TITLE_SUFFIX}`);
    });
  });

  describe('lazy component resolution', () => {
    beforeEach(() => {
      resetRouteComponentCache();
    });

    it('memoizes one component per route id', () => {
      const first = getRouteComponent('overview');
      const second = getRouteComponent('overview');
      expect(first).not.toBeNull();
      expect(first).toBe(second);
    });
  });
});
