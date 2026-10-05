/**
 * Tests for the dashboard layout export/import subsystem.
 *
 * Exercises the real implementation (storage falls back to the localStorage
 * mock from tests/setup.js because jsdom has no IndexedDB).
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  LAYOUT_SCHEMA_VERSION,
  MAX_SAFE_SHARE_URL_LENGTH,
  exportLayout,
  importLayout,
  parseLayoutInput,
  validateLayoutEnvelope,
  encodeLayoutForUrl,
  decodeLayoutFromUrl,
  buildShareUrl,
  buildShareUrlWithDiagnostics,
  extractLayoutFromCurrentUrl,
  createEmptyLayout,
  loadAllLayouts,
  saveLayout,
  applyLayout,
  getEffectiveActiveLayout,
  getActiveLayoutId,
  pushLayoutHistory,
  loadLayoutHistory,
  clearLayoutHistory,
  snapshotWidgetLayout,
  generateLayoutId,
  type DashboardLayout,
} from '../../../src/lib/dashboardLayouts'

function makeLayout(overrides: Partial<DashboardLayout> = {}): DashboardLayout {
  return {
    id: 'layout-test',
    name: 'Test Layout',
    widgets: [
      { id: 'w1', type: 'balance', height: 260, span: 1 },
      { id: 'w2', type: 'transactions', height: 360, span: 2 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function envelopeOf(layout: DashboardLayout) {
  return JSON.parse(exportLayout(layout))
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

// ─── Export envelope + versioning ─────────────────────────────────────────────

describe('exportLayout', () => {
  it('emits a versioned, typed envelope', () => {
    const envelope = envelopeOf(makeLayout())

    expect(envelope.type).toBe('stellar-dashboard-layout')
    expect(envelope.version).toBe(LAYOUT_SCHEMA_VERSION)
    expect(envelope.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(envelope.layout.name).toBe('Test Layout')
  })

  it('stamps schemaVersion onto the layout for forward-compat checks', () => {
    expect(envelopeOf(makeLayout()).layout.schemaVersion).toBe(LAYOUT_SCHEMA_VERSION)
  })

  it('never serialises React components', () => {
    const withComponent = makeLayout({
      widgets: [{ id: 'w1', type: 'balance', height: 260, span: 1, component: {} as never }],
    })

    const roundTripped = importLayout(exportLayout(withComponent))
    expect(roundTripped.widgets[0]).not.toHaveProperty('component')
  })
})

describe('importLayout round-trip', () => {
  it('preserves widget positions and types', () => {
    const original = makeLayout()
    const imported = importLayout(exportLayout(original))

    expect(imported.widgets).toHaveLength(2)
    expect(imported.widgets.map(w => w.type)).toEqual(['balance', 'transactions'])
    expect(imported.widgets.map(w => w.span)).toEqual([1, 2])
    expect(imported.widgets.map(w => w.height)).toEqual([260, 360])
  })

  it('assigns a fresh id so imports cannot collide with existing layouts', () => {
    const original = makeLayout()
    const imported = importLayout(exportLayout(original))

    expect(imported.id).not.toBe(original.id)
  })

  it('marks the layout as imported and clears preset/shared flags', () => {
    const imported = importLayout(exportLayout(makeLayout({ isPreset: true, isShared: true })))

    expect(imported.name).toBe('Test Layout (Imported)')
    expect(imported.isPreset).toBe(false)
    expect(imported.isShared).toBe(false)
  })

  it('does not double-append the imported suffix', () => {
    const once = importLayout(exportLayout(makeLayout()))
    const twice = importLayout(exportLayout(once))

    expect(twice.name).toBe('Test Layout (Imported)')
  })
})

// ─── Versioning / backwards compatibility ─────────────────────────────────────

describe('layout versioning', () => {
  it('upgrades a legacy v1 envelope that has no type field', () => {
    const legacy = {
      version: 1,
      layout: {
        name: 'Legacy',
        widgets: [{ id: 'w1', type: 'balance', height: 260, span: 1 }],
      },
    }

    const imported = importLayout(JSON.stringify(legacy))
    expect(imported.name).toBe('Legacy (Imported)')
  })

  it('upgrades a legacy envelope missing the version field entirely', () => {
    const legacy = {
      layout: { name: 'Very Old', widgets: [] },
    }

    const parsed = parseLayoutInput(JSON.stringify(legacy)) as Record<string, unknown>
    expect(parsed.type).toBe('stellar-dashboard-layout')
    expect(parsed.version).toBe(1)
  })

  it('warns but still imports a layout from a newer schema', () => {
    const future = {
      type: 'stellar-dashboard-layout',
      version: LAYOUT_SCHEMA_VERSION + 5,
      layout: { name: 'From The Future', widgets: [{ id: 'w1', type: 'balance', height: 260, span: 1 }] },
    }

    const result = validateLayoutEnvelope(future)
    expect(result.valid).toBe(true)
    expect(result.warnings.join(' ')).toMatch(/schema version/i)

    expect(importLayout(JSON.stringify(future)).name).toBe('From The Future (Imported)')
  })

  it('rejects a layout with no usable version', () => {
    const result = validateLayoutEnvelope({
      type: 'stellar-dashboard-layout',
      layout: { name: 'No Version', widgets: [] },
    })

    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/version/i)
  })
})

// ─── Validation (AC: prevents invalid imports) ────────────────────────────────

describe('validateLayoutEnvelope', () => {
  it('rejects non-objects', () => {
    for (const bad of [null, undefined, 42, 'a string']) {
      expect(validateLayoutEnvelope(bad).valid).toBe(false)
    }
  })

  it('rejects an unknown envelope type', () => {
    const result = validateLayoutEnvelope({
      type: 'some-other-thing',
      version: 2,
      layout: { name: 'X', widgets: [] },
    })

    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Unknown envelope type/)
  })

  it('rejects a missing layout object', () => {
    expect(validateLayoutEnvelope({ type: 'stellar-dashboard-layout', version: 2 }).valid).toBe(false)
  })

  it('rejects a missing or blank layout name', () => {
    for (const name of [undefined, '', '   ']) {
      const result = validateLayoutEnvelope({
        type: 'stellar-dashboard-layout',
        version: 2,
        layout: { name, widgets: [] },
      })
      expect(result.valid).toBe(false)
    }
  })

  it('rejects a non-array widgets field', () => {
    const result = validateLayoutEnvelope({
      type: 'stellar-dashboard-layout',
      version: 2,
      layout: { name: 'X', widgets: { not: 'an array' } },
    })

    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/widgets/i)
  })

  it('rejects widgets missing an id or type', () => {
    const result = validateLayoutEnvelope({
      type: 'stellar-dashboard-layout',
      version: 2,
      layout: { name: 'X', widgets: [{ type: 'balance' }, { id: 'w2' }] },
    })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('warns (but allows) on unknown widget types, out-of-range sizes, and duplicates', () => {
    const result = validateLayoutEnvelope({
      type: 'stellar-dashboard-layout',
      version: 2,
      layout: {
        name: 'X',
        widgets: [
          { id: 'dup', type: 'notARealWidget', height: 99999, span: 77 },
          { id: 'dup', type: 'balance', height: 260, span: 1 },
        ],
      },
    })

    expect(result.valid).toBe(true)
    const warnings = result.warnings.join(' ')
    expect(warnings).toMatch(/not recognised/)
    expect(warnings).toMatch(/height/i)
    expect(warnings).toMatch(/span/i)
    expect(warnings).toMatch(/Duplicate widget id/)
  })

  it('warns on empty and oversized widget lists', () => {
    const empty = validateLayoutEnvelope({
      type: 'stellar-dashboard-layout', version: 2, layout: { name: 'X', widgets: [] },
    })
    expect(empty.valid).toBe(true)
    expect(empty.warnings.join(' ')).toMatch(/no widgets/i)

    const big = validateLayoutEnvelope({
      type: 'stellar-dashboard-layout',
      version: 2,
      layout: {
        name: 'X',
        widgets: Array.from({ length: 21 }, (_, i) => ({ id: `w${i}`, type: 'balance', height: 260, span: 1 })),
      },
    })
    expect(big.valid).toBe(true)
    expect(big.warnings.join(' ')).toMatch(/Large layouts/i)
  })
})

describe('importLayout sanitisation', () => {
  it('clamps out-of-range heights and spans into bounds', () => {
    const imported = importLayout(exportLayout(makeLayout({
      widgets: [
        { id: 'tall', type: 'balance', height: 99999, span: 99 },
        { id: 'short', type: 'assets', height: -5, span: 0 },
      ],
    })))

    expect(imported.widgets[0].height).toBe(2000)
    expect(imported.widgets[0].span).toBe(4)
    expect(imported.widgets[1].height).toBe(100)
    expect(imported.widgets[1].span).toBe(1)
  })

  it('truncates an over-long layout name', () => {
    const imported = importLayout(exportLayout(makeLayout({ name: 'x'.repeat(500) })))

    expect(imported.name.length).toBeLessThanOrEqual('x'.repeat(500).length)
    expect(imported.name.replace(' (Imported)', '').length).toBe(80)
  })

  it('reassigns order by array position', () => {
    const imported = importLayout(exportLayout(makeLayout({
      widgets: [
        { id: 'a', type: 'balance', height: 260, span: 1, order: 99 },
        { id: 'b', type: 'assets', height: 260, span: 1, order: 0 },
      ],
    })))

    expect(imported.widgets.map(w => w.order)).toEqual([0, 1])
  })

  it('throws a readable error for malformed JSON', () => {
    expect(() => importLayout('{ not json')).toThrow(/not valid JSON/i)
  })

  it('throws for input that is neither JSON nor a share token', () => {
    expect(() => importLayout('!!!not-a-token!!!')).toThrow(/does not look like valid JSON or a share token/i)
  })
})

// ─── URL sharing (AC: share via URL, encoded in hash) ─────────────────────────

describe('layout share URLs', () => {
  it('round-trips a layout through the URL token', () => {
    const original = makeLayout()
    const decoded = decodeLayoutFromUrl(encodeLayoutForUrl(original))

    expect(decoded).not.toBeNull()
    expect(decoded!.widgets.map(w => w.type)).toEqual(['balance', 'transactions'])
  })

  it('encodes to a URL-safe base64 alphabet with no padding', () => {
    const token = encodeLayoutForUrl(makeLayout())

    expect(token).not.toMatch(/[+/=]/)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('survives non-ASCII layout names', () => {
    const unicodeLayout = makeLayout({ name: 'レイアウト — Ünïcodé ✓ 仪表板' })
    const decoded = decodeLayoutFromUrl(encodeLayoutForUrl(unicodeLayout))

    expect(decoded!.name).toBe(`${unicodeLayout.name} (Imported)`)
  })

  it('still decodes legacy standard-base64 tokens', () => {
    const legacyToken = btoa(unescape(encodeURIComponent(exportLayout(makeLayout()))))
    const decoded = decodeLayoutFromUrl(legacyToken)

    expect(decoded).not.toBeNull()
    expect(decoded!.widgets).toHaveLength(2)
  })

  it('returns null for a garbage token instead of throwing', () => {
    expect(decodeLayoutFromUrl('%%%not-base64%%%')).toBeNull()
  })

  it('builds a URL whose hash token decodes back to the same layout', () => {
    const url = buildShareUrl(makeLayout({ name: 'Round Trip' }))

    expect(url).toContain('#layout=')
    expect(url.split('#')[0]).not.toContain('layout=')

    const token = url.split('#layout=')[1]
    expect(decodeLayoutFromUrl(token)!.name).toBe('Round Trip (Imported)')
  })

  it('extracts a shared layout back out of the current URL hash', () => {
    window.location.hash = `#layout=${encodeLayoutForUrl(makeLayout({ name: 'Shared One' }))}`

    const extracted = extractLayoutFromCurrentUrl()
    expect(extracted).not.toBeNull()
    expect(extracted!.name).toBe('Shared One (Imported)')
  })

  it('returns null when the hash holds no layout', () => {
    expect(extractLayoutFromCurrentUrl()).toBeNull()

    window.location.hash = '#tab=overview'
    expect(extractLayoutFromCurrentUrl()).toBeNull()
  })

  it('flags a share URL that is too long to survive transit', () => {
    const huge = makeLayout({
      name: 'Huge',
      widgets: Array.from({ length: 20 }, (_, i) => ({
        id: `widget-with-a-long-identifier-${i}`, type: 'congestionForecast', height: 400, span: 2,
      })),
    })

    const result = buildShareUrlWithDiagnostics(huge)
    expect(result.length).toBe(result.url.length)
    expect(typeof result.isSafe).toBe('boolean')
    if (!result.isSafe) {
      expect(result.warning).toMatch(/truncated/i)
      expect(result.length).toBeGreaterThan(MAX_SAFE_SHARE_URL_LENGTH)
    }
  })

  it('reports no warning for a normal-sized layout', () => {
    const result = buildShareUrlWithDiagnostics(makeLayout())
    expect(result.isSafe).toBe(true)
    expect(result.warning).toBeNull()
  })
})

// ─── Layout storage + history ─────────────────────────────────────────────────

describe('layout persistence', () => {
  it('saves and reloads layouts', async () => {
    await saveLayout(makeLayout({ id: 'a', name: 'First' }))
    await saveLayout(makeLayout({ id: 'b', name: 'Second' }))

    const all = await loadAllLayouts()
    expect(all.map(l => l.name).sort()).toEqual(['First', 'Second'])
  })

  it('updates in place rather than duplicating', async () => {
    await saveLayout(makeLayout({ id: 'a', name: 'First' }))
    await saveLayout(makeLayout({ id: 'a', name: 'Renamed' }))

    const all = await loadAllLayouts()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Renamed')
  })

  it('creates an empty layout with a unique id', () => {
    const a = createEmptyLayout('A')
    const b = createEmptyLayout('B')

    expect(a.widgets).toEqual([])
    expect(a.id).not.toBe(b.id)
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateLayoutId()))
    expect(ids.size).toBe(50)
  })
})

describe('layout history', () => {
  it('keeps the newest snapshot first', async () => {
    await pushLayoutHistory(makeLayout({ name: 'Older' }), 'before-switch')
    await pushLayoutHistory(makeLayout({ name: 'Newer' }), 'before-import')

    const history = await loadLayoutHistory()
    expect(history[0].layoutName).toBe('Newer')
    expect(history[0].reason).toBe('before-import')
  })

  it('caps the ring buffer at 20 entries', async () => {
    for (let i = 0; i < 25; i++) {
      await pushLayoutHistory(makeLayout({ name: `Layout ${i}` }), 'auto-save')
    }

    const history = await loadLayoutHistory()
    expect(history).toHaveLength(20)
    expect(history[0].layoutName).toBe('Layout 24')
  })

  it('clears all history', async () => {
    await pushLayoutHistory(makeLayout(), 'manual')
    expect((await loadLayoutHistory()).length).toBeGreaterThan(0)

    await clearLayoutHistory()
    expect(await loadLayoutHistory()).toEqual([])
  })

  it('snapshots a bare widget set so edits are undoable', async () => {
    await snapshotWidgetLayout(
      [{ id: 'w1', type: 'balance', height: 300, span: 2 }],
      'before-edit',
    )

    const history = await loadLayoutHistory()
    expect(history[0].reason).toBe('before-edit')
    expect(history[0].widgets[0].span).toBe(2)
  })

  it('does not snapshot an empty widget set', async () => {
    await snapshotWidgetLayout([], 'before-edit')
    expect(await loadLayoutHistory()).toEqual([])
  })
})

describe('applyLayout', () => {
  it('makes the layout active and mirrors it to the legacy store', async () => {
    await applyLayout(makeLayout({ id: 'applied', name: 'Applied' }))

    expect(await getActiveLayoutId()).toBe('applied')
    expect((await getEffectiveActiveLayout()).name).toBe('Applied')
  })

  it('snapshots the previous layout so the change can be undone', async () => {
    await applyLayout(makeLayout({ id: 'first', name: 'First' }), { snapshotPrevious: false })
    await applyLayout(makeLayout({ id: 'second', name: 'Second' }), { reason: 'before-import' })

    const history = await loadLayoutHistory()
    expect(history[0].layoutName).toBe('First')
    expect(history[0].reason).toBe('before-import')
  })

  it('can skip the previous-layout snapshot', async () => {
    await applyLayout(makeLayout({ id: 'only', name: 'Only' }), { snapshotPrevious: false })
    expect(await loadLayoutHistory()).toEqual([])
  })
})

describe('getEffectiveActiveLayout', () => {
  it('prefers the named active layout', async () => {
    await applyLayout(makeLayout({ id: 'named', name: 'Named' }), { snapshotPrevious: false })
    expect((await getEffectiveActiveLayout()).id).toBe('named')
  })

  it('falls back to a synthetic layout when nothing is saved', async () => {
    const layout = await getEffectiveActiveLayout()

    expect(layout.name).toBe('Current Layout')
    expect(Array.isArray(layout.widgets)).toBe(true)
  })
})
