# Design System

This document is the authoritative reference for the Stellar Dev Dashboard design system.
The interactive token catalog, variant browser, accessibility guidelines, performance budgets,
and migration guides all live in Storybook under the **Design System** section — run
`npm run storybook` and navigate to **Design System / Tokens**.

---

## Overview

The design system has five layers:

| Layer | Purpose | Source |
|-------|---------|--------|
| **Design Tokens** | Single source of truth for color, spacing, typography, radii, motion | `src/design-system/` |
| **Variants** | Explicit, composable component styles built from tokens | `src/design-system/variants.ts` |
| **Consistency** | Automated lint, snapshot, and CI checks | ESLint + Playwright |
| **Documentation** | Storybook-first component docs | `stories/` |
| **Migration** | Versioned guides for breaking changes | `docs/api/CHANGELOG.md` + Storybook |

---

## 1. Design Tokens

Tokens are the single source of truth. They are defined in TypeScript and consumed
via CSS custom properties at runtime.

### Token Files

| File | Exports | Description |
|------|---------|-------------|
| `src/design-system/tokens.ts` | `tokens` | Master token object — colors, spacing, typography, radii, motion |
| `src/design-system/colors.ts` | `colors` | `tokens.colors` re-export |
| `src/design-system/spacing.ts` | `spacing` | `tokens.spacing` re-export |
| `src/design-system/typography.ts` | `typography` | `tokens.typography` re-export |
| `src/design-system/variants.ts` | `variantSystem` | Component variant catalog |
| `src/design-system/index.ts` | all above | Barrel export |

### Color Tokens

Semantic names prevent hard-coded hex values from leaking into components.

```ts
import { colors } from 'src/design-system';

// ✅ Use semantic tokens
colors.surface.card          // '#0f172a'
colors.text.primary          // '#f8fafc'
colors.semantic.success      // '#28a745'
colors.border.default        // 'rgba(148,163,184,0.22)'
```

At runtime, components use CSS custom properties so they theme-switch automatically:

```css
/* src/styles/globals.css — dark theme (default) */
:root, [data-theme='dark'] {
  --bg-base:      #08111f;
  --bg-card:      #0f172a;
  --bg-elevated:  #111827;
  --cyan:         #00e5ff;
  --green:        #22c55e;
  --red:          #ef4444;
  --amber:        #f59e0b;
  --text-primary: #f8fafc;
  --text-muted:   #94a3b8;
  --border:       rgba(148,163,184,0.22);
  --font-sans:    'Inter', system-ui, sans-serif;
  --font-display: 'Syne', sans-serif;
  --font-mono:    'Space Mono', monospace;
}
```

### Spacing Scale

```
xs  → 4px
sm  → 8px
md  → 16px
lg  → 24px
xl  → 32px
xxl → 48px
```

Layout-specific aliases: `spacing.layout.page = 24px`, `.section = 32px`, `.card = 16px`.

### Typography

| Token | Value |
|-------|-------|
| `typography.fontFamily.display` | `'Syne, sans-serif'` |
| `typography.fontFamily.body` | `'Inter, system-ui, sans-serif'` |
| `typography.fontFamily.mono` | `'Space Mono, monospace'` |
| `typography.fontSize.xs` | `12px` |
| `typography.fontSize.sm` | `14px` |
| `typography.fontSize.md` | `16px` |
| `typography.fontSize.lg` | `20px` |
| `typography.fontSize.xl` | `24px` |

### Border Radii

```
xs   → 4px     (chips, small badges)
sm   → 8px     (inputs, buttons)
md   → 12px    (cards, dropdowns)
lg   → 16px    (panels, modals)
xl   → 24px    (large surfaces)
pill → 999px   (network badges, tags)
```

### Motion

| Token | Value | Use |
|-------|-------|-----|
| `motion.duration.fast` | `120ms` | Hover, focus rings |
| `motion.duration.normal` | `180ms` | Transitions, open/close |
| `motion.duration.slow` | `280ms` | Full panel animations |
| `motion.easing.standard` | `cubic-bezier(0.2,0,0,1)` | Most transitions |
| `motion.easing.emphasized` | `cubic-bezier(0.2,0.8,0.2,1)` | Emphasized entrances |

Always check `prefers-reduced-motion` and set duration to `0` when it is active.

---

## 2. Variants

Component variants are defined in `src/design-system/variants.ts` as a `VariantGroup[]`.
Each `VariantDefinition` records which tokens compose the variant, so changing a token
cascades automatically.

```ts
import { variantSystem } from 'src/design-system';

// Find a specific variant
const primaryButton = variantSystem
  .find(g => g.key === 'buttons')
  ?.variants.find(v => v.key === 'primary');
```

Variant statuses:
- **ready** — implemented and tested
- **guidance** — design intent documented; component may not yet enforce it
- **planned** — reserved for a future implementation

See the **Design System / Component Variants** story in Storybook for the interactive catalog.

---

## 3. Consistency

Consistency is enforced by automation, not convention.

### Linting

```bash
npm run lint        # ESLint — naming conventions, import rules, unused vars
npm run type-check  # TypeScript strict mode (src/lib/**)
```

### Visual Testing

```bash
npm run test:visual          # Playwright visual snapshots
npm run test:visual:update   # Update snapshots after intentional changes
npm run test:chromatic        # Chromatic cloud snapshots (CI)
```

### CI Checks

Every PR runs:
1. ESLint + Prettier
2. TypeScript type check
3. Unit tests + coverage gate
4. Playwright visual and a11y tests
5. Bundle size check (500 KB gzip limit)
6. Storybook build validation

---

## 4. Documentation

Documentation is Storybook-first. Every public component has a story that shows:

- All visual states (default, loading, error, empty, disabled)
- Dark and light theme
- Mobile, tablet, and desktop viewports
- axe-core accessibility pass (visible in the A11y panel)
- Prop table (via `argTypes` or the TypeScript interface)

Story files live at:
- `stories/*.stories.tsx` — standalone stories
- `src/components/**/*.stories.tsx` — co-located stories (scanned by Storybook)

### Adding a New Component Story

1. Create `stories/MyComponent.stories.tsx`.
2. Set `title` to match the component's group (e.g., `'Layout/MyComponent'`).
3. Add `parameters.docs.description.component` to explain what the component does.
4. Export named stories for: Default, Loading (if async), Error state, Mobile viewport.
5. If the component depends on Zustand or external APIs, use a standalone replica
   (see `ThemeToggle.stories.tsx` for the pattern).

---

## 5. Migration

Migration guides are documented in two places:

1. **`docs/api/CHANGELOG.md`** — machine-readable changelog.
2. **Design System / Migration story in Storybook** — human-readable guides with
   before/after code examples.

When introducing a breaking change:

1. Add an entry to `CHANGELOG.md` under `## Breaking Changes`.
2. Add a migration entry to `stories/Migration.stories.tsx`.
3. If the change is automatable, provide a codemod command.
4. Keep legacy token aliases active until all call sites are migrated.

---

## Maintenance Notes

- Keep legacy token aliases until all call sites have been migrated.
- Prefer composition over new variants unless the new style has a clear reusable purpose.
- Update this document and the relevant Storybook story whenever a token, variant, or rule changes.
- Run `npm run storybook` to verify changes visually before pushing.
