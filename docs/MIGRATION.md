# Migration Guide

Human-readable migration instructions for Stellar Dev Dashboard component library changes.
The interactive version with before/after code examples lives in Storybook:
**Design System / Migration**.

Full changelog: `docs/api/CHANGELOG.md`.

---

## Version History

### v0.1.0 (June 2025) — Initial Release

First public release. No migration required.

**Added:**
- Dashboard shell: Sidebar, MobileHeader, MobileSidebar, DashboardGrid
- Core components: Card, StatCard, CopyableValue, ThemeToggle
- Chart suite: NetworkMetricsChart, BalanceHistoryChart, AccountActivityChart
- Accessibility: AccessibilitySettings, ScreenReaderAnnouncer, KeyboardNavigation
- Network: NetworkIndicator, OfflineBanner, RetryButton
- Assets: AssetCard, AssetDiscovery
- Forms: ValidatedInput
- Design system: tokens, colors, spacing, typography, variants
- Storybook 8.5 with a11y, viewport addons, and dark/light theme toolbar

---

## Breaking Changes

No breaking changes in v0.1.0.

Future breaking changes will be documented here with migration steps and, where possible,
a codemod command.

---

## Active Migration Tracks

### JavaScript → TypeScript

The codebase is migrating from `.jsx` to `.tsx`. New components **must** be TypeScript.

**Steps for converting an existing component:**

1. Rename the file from `.jsx` to `.tsx`.
2. Add prop types using interfaces from `src/types/components.ts` where they exist.
3. Run `npm run type-check` to surface type errors.
4. Fix errors — the `tsconfig.json` has `allowJs: true` so no config changes are needed.
5. Update any `.stories.tsx` imports if the file extension changed.

```ts
// src/types/components.ts — add your interface
export interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

// src/components/dashboard/MyComponent.tsx
import type { MyComponentProps } from '../../types/components';

export default function MyComponent({ title, onAction }: MyComponentProps) { … }
```

---

### Inline Styles → CSS Custom Properties

Components should use `var(--token)` rather than hard-coded hex values.

```jsx
// ❌ Before
<div style={{ color: '#f8fafc', background: '#0f172a' }}>

// ✅ After
<div style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}>
```

Reference the full token list in `docs/design-system.md` or the **Design System / Tokens**
Storybook story.

Do **not** remove legacy token aliases until all call sites are migrated.

---

### Adopting the Variant System

New component variants should live in `src/design-system/variants.ts`, not as ad-hoc inline
style objects scattered across component files.

```ts
// src/design-system/variants.ts — add to the relevant group
{
  key: 'ghost',
  label: 'Ghost',
  description: 'Transparent background, border only. For tertiary actions.',
  composition: ['border.default', 'text.primary', 'radii.sm'],
  status: 'planned', // → 'ready' once implemented
}
```

---

## Adding a Breaking Change (for maintainers)

1. Add to `docs/api/CHANGELOG.md` under `## Breaking Changes` for the next version.
2. Add a migration entry to `stories/Migration.stories.tsx`.
3. If automatable, provide a codemod: `npx codemod <package-name>`.
4. Keep legacy aliases active for at least one minor version before removing them.
5. Update this document.
