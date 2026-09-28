# Chart Accessibility Guide

Addresses [#777 — Provide text alternatives for interactive charts](.github/roadmap-issues-2026-07-29.json).

Recharts renders an SVG with no built-in semantics: screen reader users get
nothing, and keyboard-only users can't reach the data behind a line or bar.
This guide describes the reusable pattern used across the dashboard's
Recharts components and analytics views to fix that.

## The pattern

Two pieces do the work:

- **`src/utils/chartAccessibility.ts`** — framework-free helpers that turn a
  chart's dataset into text:
  - `isRenderableChartData(data)` — validates a dataset before rendering.
    Returns `false` for `null`/`undefined`/non-arrays/empty arrays instead of
    throwing, so callers can show a "no data" state.
  - `summarizeSeries(data, series)` — min/max/average/trend for one series.
    Non-finite or missing values are skipped rather than coerced to `0`, so
    malformed rows don't skew the average.
  - `describeChart({ title, data, series })` — one sentence combining the
    above, used as the screen-reader summary.
  - `buildChartTable(data, columns)` — converts the dataset into
    `{ headers, rows }` for an HTML table.

- **`src/components/charts/AccessibleChart.tsx`** — a wrapper component:
  - Renders the visually-hidden summary sentence and attaches it to the chart
    via `aria-describedby`.
  - Renders a "Show data table" button (a real, keyboard-focusable
    `<button aria-expanded>`) that reveals an HTML `<table>` with `scope="col"`
    / `scope="row"` headers — usable with a screen reader or keyboard alone,
    and independent of SVG/canvas support.
  - If `data` is missing, empty, or not an array (an unsupported environment,
    a failed fetch, a bad API response), it renders a `role="status"` message
    **instead of** the chart tree — it never passes malformed data into
    Recharts, which would otherwise render a blank or broken SVG with no
    indication anything went wrong.

## Usage

```tsx
import AccessibleChart from '../charts/AccessibleChart';

<AccessibleChart
  title="Fees (Stroops)"
  data={data}
  series={[{ key: 'fees', label: 'Fees', unit: 'stroops' }]}
  categoryKey="date"
  categoryLabel="Date"
  height={250}
  emptyMessage="No fee data is currently available."
>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      {/* ...existing Recharts tree, unchanged... */}
    </BarChart>
  </ResponsiveContainer>
</AccessibleChart>
```

The Recharts tree itself does not change — `AccessibleChart` only wraps it.
`series` should list the same `dataKey`s already passed to `<Line>`/`<Bar>`/
`<Area>` so the summary and table stay in sync with what's drawn.

## Compatibility notes

- No new dependencies; the table and summary are plain HTML/ARIA.
- Works when Recharts fails to render (e.g. `ResponsiveContainer` measuring a
  zero-size container in some test/SSR environments) because the summary and
  table are rendered independently of the chart's own rendering path.
- The empty/failure state replaces the chart entirely rather than rendering
  Recharts with invalid data, avoiding console errors from malformed props.

## Adopted so far

- `src/components/charts/AnalyticsChart.jsx` (activity, latency, fee trend charts)
- `src/components/dashboard/NetworkStats.tsx` (consensus close time / operations chart)
- `src/components/dashboard/TransactionAnalyticsDashboard.tsx` (frequency, amount distribution)

## Migrating another chart

The dashboard has ~28 files importing from `recharts` (see
`src/components/dashboard/*`, `src/components/charts/*`,
`src/components/sentiment/SentimentVisualizations.tsx`). To migrate one:

1. Import `AccessibleChart` from `src/components/charts/AccessibleChart`.
2. Wrap the existing `<ResponsiveContainer>`/chart tree in `<AccessibleChart>`,
   passing the same `data` array, a `title`, and a `series` array describing
   each plotted `dataKey`.
3. Set `categoryKey` to whatever field drives the X axis (`date`, `timestamp`,
   `sequence`, etc.).
4. Leave the inner Recharts markup untouched — no prop changes needed there.

No chart should be migrated by deleting its visual rendering; `AccessibleChart`
is additive.

## Testing

- `src/utils/__tests__/chartAccessibility.test.ts` — primary flow (multi-point
  trend), boundary cases (single point, empty array), and failure cases
  (non-array/`null`/non-numeric values) for every helper.
- `src/components/charts/__tests__/AccessibleChart.test.tsx` — renders with
  data and asserts the summary text and keyboard-toggleable table; asserts the
  empty-state and malformed-data fallbacks render `role="status"` instead of
  the chart.
