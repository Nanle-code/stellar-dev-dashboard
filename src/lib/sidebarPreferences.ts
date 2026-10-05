import { GROUP_LABELS, type RouteGroup } from '../routes/routes';

export const SIDEBAR_GROUP_STATE_KEY = 'stellar_sidebar_collapsed_groups';
const DEFAULT_COLLAPSED_GROUPS: RouteGroup[] = ['admin'];

export function loadCollapsedSidebarGroups(
  storage?: Pick<Storage, 'getItem'>,
): RouteGroup[] {
  try {
    const persisted = (storage ?? window.localStorage).getItem(SIDEBAR_GROUP_STATE_KEY);
    if (persisted === null) return [...DEFAULT_COLLAPSED_GROUPS];

    const parsed: unknown = JSON.parse(persisted);
    if (!Array.isArray(parsed)) return [...DEFAULT_COLLAPSED_GROUPS];

    return parsed.filter(
      (group): group is RouteGroup =>
        typeof group === 'string' && Object.prototype.hasOwnProperty.call(GROUP_LABELS, group),
    );
  } catch {
    return [...DEFAULT_COLLAPSED_GROUPS];
  }
}

export function saveCollapsedSidebarGroups(
  groups: RouteGroup[],
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(SIDEBAR_GROUP_STATE_KEY, JSON.stringify(groups));
  } catch {
    // Navigation remains usable when browser storage is unavailable.
  }
}
