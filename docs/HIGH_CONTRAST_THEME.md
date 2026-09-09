# High Contrast Theme — Developer Guide (#778)

## Overview

The high-contrast theme improves accessibility by ensuring all UI elements meet WCAG 2.1 Level AA (4.5:1) minimum contrast, with most elements achieving Level AAA (7:1). It builds on top of the existing light/dark theme system by adding a `data-high-contrast="true"` attribute to the `<html>` element via the `AccessibilityContext`.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  AccessibilityContext.tsx                                     │
│  sets data-high-contrast="true" on <html>                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
┌──────────────────────┐        ┌──────────────────────────┐
│  globals.css          │        │  chartUtils.js            │
│  [data-theme="dark"]  │        │  getChartColors(          │
│   [data-high-         │        │    isHighContrast,        │
│    contrast="true"]   │        │    theme                  │
│  { ... }              │        │  ) → CHART_COLORS_HC      │
└──────────────────────┘        └──────────────────────────┘
```

### Layer 1: CSS Custom Properties (`globals.css`)

Two compound selectors handle high-contrast for each base theme:

| Selector | Background | Primary accent | Text |
|---|---|---|---|
| `[data-theme="dark"][data-high-contrast="true"]` | `#000000` | `#00ffff` (cyan) | `#ffffff` |
| `[data-theme="light"][data-high-contrast="true"]` | `#ffffff` | `#0000cc` (blue) | `#000000` |

### Layer 2: Chart Colors (`chartUtils.js`)

JavaScript consumers call `getChartColors(isHighContrast, theme)` to get the right palette:

```ts
import { getChartColors, getStatusColors } from '../lib/chartUtils'

const colors = getChartColors(isHighContrast, theme)
// Use colors.cyan, colors.amber, colors.green, colors.red, etc.
```

### Layer 3: Status Indicators

`getStatusColors(isHighContrast)` returns semantic color pairs with background/foreground:

```ts
const status = getStatusColors(true)
// { success: { bg, fg }, warning: { bg, fg }, error: { bg, fg }, info: { bg, fg } }
```

## Usage

### For component authors

```tsx
import { useAccessibility } from '../context/AccessibilityContext'
import { getChartColors } from '../lib/chartUtils'
import { useStore } from '../lib/store'

function MyChart() {
  const { settings } = useAccessibility()
  const { theme } = useStore()
  const colors = getChartColors(settings.highContrast, theme)

  return <LineChart stroke={colors.cyan} />
}
```

### For CSS authors

Use the existing CSS custom properties as normal — they are automatically overridden by the `[data-high-contrast="true"]` selector cascade:

```css
.my-component {
  background: var(--bg-card);      /* auto-switches in HC mode */
  color: var(--text-primary);       /* auto-switches in HC mode */
  border: 1px solid var(--border);  /* auto-switches in HC mode */
}
```

## Contrast Ratios

| Color pair | Dark HC contrast | Light HC contrast | WCAG level |
|---|---|---|---|
| Text on background | 21:1 | 21:1 | AAA |
| Cyan on background | 16.8:1 | 8.6:1 | AAA |
| Amber (yellow) on background | 19.6:1 | 5.8:1 | AA |
| Green on background | 15.3:1 | 5.1:1 | AA |
| Red on background | 4.5:1 | 5.3:1 | AA |

> **Note:** The red accent intentionally targets AA (4.5:1) rather than AAA to maintain a visually distinct error/success/warning palette. For critical error text, use `var(--text-primary)` directly.

## Forced Colors Mode (Windows High Contrast)

The system-level `forced-colors: active` media query is also handled in `globals.css`, which overrides colors with system tokens (`CanvasText`, `ButtonText`, etc.). This works independently of the dashboard's high-contrast toggle and takes precedence.

## Failure Handling

| Scenario | Behavior |
|---|---|
| `localStorage` unavailable | Falls back to default (no high-contrast) |
| SSR (no `document`) | `applyCustomThemeToDOM` / `removeCustomThemeFromDOM` are no-ops |
| Invalid `isHighContrast` value (null, undefined) | `getChartColors` returns standard palette |
| Unknown theme string | Falls back to dark high-contrast palette |
| Corrupt theme definition | `isThemeDefinition` type guard rejects it; import throws |

## Migration Notes

- Existing CSS custom properties (`--bg-base`, `--cyan`, `--text-primary`, etc.) continue to work — no migration needed for existing components.
- Components that use hardcoded color hex values should migrate to `getChartColors()` for automatic HC support.
- The `AccessibilityContext` high-contrast toggle was already wired up in the UI — this implementation makes it produce visible results.

## Compatibility

- **Browsers**: All modern browsers (Chrome 88+, Firefox 85+, Safari 15+, Edge 88+)
- **Screen readers**: CSS-only change — no impact on screen reader behavior
- **System preferences**: `prefers-contrast: more` and `forced-colors: active` are respected independently

## Testing

```bash
# Run high-contrast theme tests
npx vitest run tests/unit/highContrastTheme.test.ts

# Run all unit tests
npx vitest run tests/unit/
```
