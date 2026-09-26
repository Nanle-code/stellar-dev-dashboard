# Transaction Builder i18n Coverage (#878)

The Transaction Builder (`src/components/dashboard/TransactionBuilder.tsx`)
is now fully localized: every user-visible label, placeholder, button,
prompt, alert, and simulation message comes from the `builder.*` translation
namespace instead of hard-coded English strings.

## Coverage

All nine supported locales ship the complete section — verified for key
parity by automated test:

| Locale | File | Status |
| --- | --- | --- |
| English | `src/i18n/en.json` | complete (source of truth) |
| Spanish | `src/i18n/es.json` | complete |
| French | `src/i18n/fr.json` | complete |
| German | `src/i18n/de.json` | complete |
| Portuguese (BR) | `src/i18n/pt.json` | complete |
| Chinese (Simplified) | `src/i18n/zh.json` | complete |
| Japanese | `src/i18n/ja.json` | complete |
| Korean | `src/i18n/ko.json` | complete |
| Arabic (RTL) | `src/i18n/ar.json` | complete |

The section includes nested groups:

- `builder.operationFields.*` — per-operation field labels/placeholders
  (payment, createAccount, changeTrust, manageData, offers, feeBump,
  sponsorship, clawback, invokeHostFunction arguments).
- `builder.federatedResolution.*` — federated address resolve/confirm flow.
- Simulation results, drafts, template saving, SEP-29 memo warnings, and
  undo/redo controls.

## Conventions

- **Interpolation** uses i18next double-handlebars and must match across
  locales: `{{count}}`, `{{message}}`, `{{reason}}`, `{{stroops}}`, `{{xlm}}`.
  `tests/unit/lib/i18nBuilderCoverage.test.ts` enforces this.
- **Pluralization** uses the `_other` suffix convention already configured in
  `src/i18n/index.ts` (`pluralSeparator: "_"`), e.g.
  `simulationErrorsFound` / `simulationErrorsFound_other` with
  `t('builder.simulationErrorsFound', { count })`.
- **Technical terms** (XDR, stroops, SEP-29, fee-bump, trustline) stay in
  English in translations, consistent with the protected-terms list in
  `src/lib/aiTranslation.ts`.
- The right-to-left locale (`ar`) relies on the existing `dir` handling from
  `SUPPORTED_LANGUAGES`; no component-level changes were needed.

## Maintenance

`scripts/add-builder-i18n.mjs` is the idempotent one-shot migration that
injected the section into the eight non-English files (preserving each
file's 4-space indentation and CRLF line endings). It skips locales that
already contain `builder.titleAdvanced`, so it is safe to re-run after
rebasing:

```bash
node scripts/add-builder-i18n.mjs
```

To add a **new builder key**: add it to `en.json` first, then to all eight
locale files, then run the parity test. The test fails with the exact
missing/extra key paths if any locale drifts.

## Tests

`tests/unit/lib/i18nBuilderCoverage.test.ts` covers:

- **Primary flow** — key parity with English across all locales.
- **Boundary** — placeholder consistency (`{{…}}` tokens must exist in every
  locale) and non-Latin locales must not fall back to English text.
- **Failure path** — i18next English fallback resolves for any missing key
  and unknown keys return the key path (surfacing gaps immediately in UI).
