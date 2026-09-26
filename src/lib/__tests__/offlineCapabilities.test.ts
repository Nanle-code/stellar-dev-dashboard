/**
 * Offline capability matrix — #892
 */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ROUTES } from '../../routes/routes'
import {
  OFFLINE_CAPABILITIES,
  OFFLINE_LEVELS,
  MATRIX_END_MARKER,
  MATRIX_START_MARKER,
  UnknownFeatureError,
  describeAvailability,
  extractMatrixFromDoc,
  normalizeMatrixMarkdown,
  getOfflineCapability,
  renderOfflineMatrixMarkdown,
  resolveAvailability,
} from '../offlineCapabilities'

const DOC_PATH = path.resolve(__dirname, '../../../docs/guides/offline-support.md')

const offline = { online: false, serviceWorkerSupported: true, routeCodeCached: true }

describe('offline capability registry', () => {
  it('declares a level for every registered route', () => {
    const missing = ROUTES.map((r) => r.id).filter((id) => !(id in OFFLINE_CAPABILITIES))
    expect(missing).toEqual([])
  })

  it('has no entries for routes that no longer exist', () => {
    const ids = new Set(ROUTES.map((r) => r.id))
    expect(Object.keys(OFFLINE_CAPABILITIES).filter((id) => !ids.has(id))).toEqual([])
  })

  it('uses only known levels and non-empty notes', () => {
    for (const [id, cap] of Object.entries(OFFLINE_CAPABILITIES)) {
      expect(OFFLINE_LEVELS, id).toContain(cap.level)
      expect(cap.notes.trim(), id).not.toBe('')
    }
  })

  it('keeps network-only surfaces online-only', () => {
    // These depend on endpoints the service worker never caches or on writes.
    for (const id of ['faucet', 'feeForecast', 'realtime', 'liveActivity', 'contractInteraction']) {
      expect(getOfflineCapability(id).level, id).toBe('online-only')
    }
  })
})

describe('resolveAvailability', () => {
  it('reports every view as available while online', () => {
    for (const route of ROUTES) {
      expect(resolveAvailability(route.id, { online: true }).status).toBe('available')
    }
  })

  it('keeps offline views fully available once their code is cached', () => {
    expect(resolveAvailability('learningHub', offline)).toMatchObject({
      status: 'available',
      level: 'offline',
    })
  })

  it('serves degraded views from cache when cached data exists', () => {
    expect(resolveAvailability('account', { ...offline, hasCachedData: true }).status).toBe(
      'degraded'
    )
  })

  it('treats a degraded view with an empty cache as unavailable (boundary)', () => {
    const result = resolveAvailability('account', { ...offline, hasCachedData: false })
    expect(result.status).toBe('unavailable')
    expect(result.reason).toMatch(/No cached data/)
  })

  it('treats an offline-capable view whose code was never loaded as unavailable (boundary)', () => {
    const result = resolveAvailability('learningHub', { ...offline, routeCodeCached: false })
    expect(result.status).toBe('unavailable')
    expect(result.reason).toMatch(/not opened while online/)
  })

  it('explains unsupported environments without a service worker', () => {
    const result = resolveAvailability('settings', {
      online: false,
      serviceWorkerSupported: false,
      routeCodeCached: false,
    })
    expect(result.status).toBe('unavailable')
    expect(result.reason).toMatch(/no service worker support/)
  })

  it('never makes online-only views available offline, even with cached data', () => {
    expect(resolveAvailability('faucet', { ...offline, hasCachedData: true }).status).toBe(
      'unavailable'
    )
  })

  it('rejects unknown and malformed feature ids', () => {
    expect(() => resolveAvailability('doesNotExist', offline)).toThrow(UnknownFeatureError)
    expect(() => resolveAvailability('toString', offline)).toThrow(UnknownFeatureError)
    expect(() => resolveAvailability('', offline)).toThrow(TypeError)
    expect(() => resolveAvailability(42, offline)).toThrow(TypeError)
  })

  it('rejects an environment without a boolean online flag', () => {
    expect(() => resolveAvailability('account', {} as never)).toThrow(TypeError)
    expect(() => resolveAvailability('account', null as never)).toThrow(TypeError)
  })

  it('describeAvailability never throws and fails closed offline', () => {
    expect(describeAvailability('doesNotExist', offline).status).toBe('unavailable')
    expect(describeAvailability('doesNotExist', { online: true }).status).toBe('available')
    expect(describeAvailability('account', null as never).status).toBe('unavailable')
  })
})

describe('docs/guides/offline-support.md', () => {
  it('embeds the current capability matrix', () => {
    const doc = fs.readFileSync(DOC_PATH, 'utf8')
    const rendered = renderOfflineMatrixMarkdown()

    if (process.env.UPDATE_OFFLINE_DOCS === '1') {
      const start = doc.indexOf(MATRIX_START_MARKER) + MATRIX_START_MARKER.length
      const end = doc.indexOf(MATRIX_END_MARKER)
      fs.writeFileSync(DOC_PATH, `${doc.slice(0, start)}\n${rendered}\n${doc.slice(end)}`)
      return
    }

    // Regenerate with: UPDATE_OFFLINE_DOCS=1 pnpm exec vitest run src/lib/__tests__/offlineCapabilities.test.ts
    const embedded = extractMatrixFromDoc(doc)
    expect(embedded).not.toBeNull()
    expect(normalizeMatrixMarkdown(embedded as string)).toBe(normalizeMatrixMarkdown(rendered))
  })

  it('lists every route path exactly once', () => {
    const matrix = renderOfflineMatrixMarkdown()
    for (const route of ROUTES) {
      expect(matrix.split(`\`${route.path}\``).length - 1, route.id).toBe(1)
    }
  })

  it('ignores formatter padding but still detects content changes', () => {
    const rendered = renderOfflineMatrixMarkdown()
    const padded = rendered.replace(/\| /g, '|   ').replace(/---/g, '-------')
    expect(normalizeMatrixMarkdown(padded)).toBe(normalizeMatrixMarkdown(rendered))
    const edited = rendered.replace('Online only', 'Works offline')
    expect(normalizeMatrixMarkdown(edited)).not.toBe(normalizeMatrixMarkdown(rendered))
  })

  it('returns null when the matrix markers are missing or out of order', () => {
    expect(extractMatrixFromDoc('# no markers')).toBeNull()
    expect(extractMatrixFromDoc(`${MATRIX_END_MARKER}\n${MATRIX_START_MARKER}`)).toBeNull()
  })
})
