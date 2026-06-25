# Design System

This document tracks the dashboard design system in five layers:

1. Design tokens
2. Variants
3. Consistency
4. Documentation
5. Migration

## 1. Design Tokens

Tokens are the source of truth for color, spacing, and typography.

- Color tokens should expose semantic names for brand, surface, text, and borders.
- Spacing tokens should stay on a small, predictable scale.
- Typography tokens should define font families, weights, sizes, and line heights.

Current implementation lives in:

- `src/design-system/tokens.ts`
- `src/design-system/colors.ts`
- `src/design-system/spacing.ts`
- `src/design-system/typography.ts`

## 2. Variants

Component variants should be explicit, predictable, and composable.

- Variant system: one catalog per component family.
- Component variants: primary, secondary, destructive, and state-specific styles.
- Variant composition: build new variants from tokens instead of adding one-off CSS.

Current implementation lives in:

- `src/design-system/variants.ts`

## 3. Consistency

Consistency comes from automation, not memory.

- Automated checks for token usage and component drift.
- Linting rules for naming, import usage, and approved patterns.
- CI validation for screenshots and visual regressions.

Recommended checks:

- ESLint rules for naming and style drift
- Snapshot or visual tests for shared components
- CI validation for token and component changes

## 4. Documentation

Documentation should help people choose the right pattern quickly.

- Design system docs: explain the system and where source files live.
- Component docs: show props, variants, and examples.
- Usage guidelines: explain when to compose, extend, or reuse.

## 5. Migration

Migration should be versioned and boring.

- Migration guides should explain how to move from the old pattern to the new one.
- Breaking changes should be listed before release.
- Version tracking should link design-system changes to release notes or changelog entries.

## Maintenance Notes

- Keep legacy token aliases until call sites have been migrated.
- Prefer composition over new variants unless the new style has a clear reusable purpose.
- Update docs whenever a token, variant, or rule changes.
