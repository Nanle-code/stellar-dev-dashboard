/**
 * Developer Experience Utilities (#463)
 *
 * Provides:
 *  - Dev toolbar state management (show/hide, panels)
 *  - React component performance profiler helpers
 *  - Memory profiler (heap snapshots)
 *  - Keyboard shortcut registry for dev actions
 *  - HMR optimisation flags
 *  - State inspector utilities
 */

// ─── Environment guard ────────────────────────────────────────────────────────

export const IS_DEV = import.meta.env.DEV === true

// ─── Profiler helpers ─────────────────────────────────────────────────────────

export interface RenderTrace {
  id: string
  phase: 'mount' | 'update'
  actualDurationMs: number
  baseDurationMs: number
  startTime: number
  timestamp: string
}

const _renderTraces: RenderTrace[] = []
const MAX_TRACES = 500

export function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
): void {
  if (!IS_DEV) return
  _renderTraces.push({
    id,
    phase,
    actualDurationMs: actualDuration,
    baseDurationMs: baseDuration,
    startTime,
    timestamp: new Date().toISOString(),
  })
  if (_renderTraces.length > MAX_TRACES) _renderTraces.shift()
}

export function getRenderTraces(componentId?: string): RenderTrace[] {
  if (componentId) return _renderTraces.filter(t => t.id === componentId)
  return [..._renderTraces]
}

export function getSlowRenders(thresholdMs = 16): RenderTrace[] {
  return _renderTraces.filter(t => t.actualDurationMs > thresholdMs)
}

export function clearRenderTraces(): void {
  _renderTraces.length = 0
}

// ─── Memory profiler ──────────────────────────────────────────────────────────

export interface HeapSnapshot {
  timestamp: string
  usedJSHeapSizeMb: number
  totalJSHeapSizeMb: number
  jsHeapSizeLimitMb: number
  usagePercent: number
}

const _heapSnapshots: HeapSnapshot[] = []

export function takeHeapSnapshot(): HeapSnapshot | null {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  if (!mem) return null
  const snap: HeapSnapshot = {
    timestamp: new Date().toISOString(),
    usedJSHeapSizeMb: +(mem.usedJSHeapSize / 1_048_576).toFixed(2),
    totalJSHeapSizeMb: +(mem.totalJSHeapSize / 1_048_576).toFixed(2),
    jsHeapSizeLimitMb: +(mem.jsHeapSizeLimit / 1_048_576).toFixed(2),
    usagePercent: +((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1),
  }
  _heapSnapshots.push(snap)
  if (_heapSnapshots.length > 100) _heapSnapshots.shift()
  return snap
}

export function getHeapSnapshots(): HeapSnapshot[] {
  return [..._heapSnapshots]
}

// ─── Keyboard shortcut registry ────────────────────────────────────────────────

export interface ShortcutDef {
  id: string
  keys: string[] // e.g. ['ctrl', 'shift', 'd']
  description: string
  handler: () => void
  devOnly?: boolean
}

const _shortcuts = new Map<string, ShortcutDef>()

export function registerShortcut(def: ShortcutDef): () => void {
  _shortcuts.set(def.id, def)
  return () => _shortcuts.delete(def.id)
}

export function getShortcuts(): ShortcutDef[] {
  return Array.from(_shortcuts.values()).filter(s => !s.devOnly || IS_DEV)
}

function matchesEvent(event: KeyboardEvent, keys: string[]): boolean {
  const pressed = new Set(keys.map(k => k.toLowerCase()))
  const active = new Set<string>()
  if (event.ctrlKey || event.metaKey) active.add('ctrl')
  if (event.shiftKey) active.add('shift')
  if (event.altKey) active.add('alt')
  active.add(event.key.toLowerCase())
  if (active.size !== pressed.size) return false
  for (const k of pressed) if (!active.has(k)) return false
  return true
}

export function installShortcutListener(): () => void {
  function onKeyDown(e: KeyboardEvent) {
    for (const shortcut of _shortcuts.values()) {
      if (shortcut.devOnly && !IS_DEV) continue
      if (matchesEvent(e, shortcut.keys)) {
        e.preventDefault()
        shortcut.handler()
        return
      }
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}

// ─── Dev toolbar state ────────────────────────────────────────────────────────

export type DevPanel = 'profiler' | 'memory' | 'shortcuts' | 'state' | 'network'

export interface DevToolbarState {
  visible: boolean
  activePanel: DevPanel
  position: 'bottom' | 'right'
  pinned: boolean
}

let _toolbarState: DevToolbarState = {
  visible: false,
  activePanel: 'profiler',
  position: 'bottom',
  pinned: false,
}

const _toolbarListeners = new Set<(state: DevToolbarState) => void>()

export function getToolbarState(): DevToolbarState {
  return { ..._toolbarState }
}

export function setToolbarState(patch: Partial<DevToolbarState>): void {
  _toolbarState = { ..._toolbarState, ...patch }
  _toolbarListeners.forEach(fn => fn({ ..._toolbarState }))
}

export function subscribeToolbar(fn: (state: DevToolbarState) => void): () => void {
  _toolbarListeners.add(fn)
  fn({ ..._toolbarState })
  return () => _toolbarListeners.delete(fn)
}

export function toggleToolbar(): void {
  setToolbarState({ visible: !_toolbarState.visible })
}

// ─── State inspector ──────────────────────────────────────────────────────────

const _stateSnapshots = new Map<string, { snapshot: unknown; timestamp: string }[]>()

export function captureStateSnapshot(componentId: string, state: unknown): void {
  if (!IS_DEV) return
  const history = _stateSnapshots.get(componentId) ?? []
  history.push({ snapshot: structuredClone(state), timestamp: new Date().toISOString() })
  if (history.length > 50) history.shift()
  _stateSnapshots.set(componentId, history)
}

export function getStateHistory(componentId: string) {
  return _stateSnapshots.get(componentId) ?? []
}

// ─── Quick-actions ─────────────────────────────────────────────────────────────

export interface QuickAction {
  id: string
  label: string
  icon?: string
  shortcutId?: string
  action: () => void
  category: 'navigation' | 'debug' | 'profiling' | 'testing'
}

const _quickActions = new Map<string, QuickAction>()

export function registerQuickAction(def: QuickAction): () => void {
  _quickActions.set(def.id, def)
  return () => _quickActions.delete(def.id)
}

export function getQuickActions(category?: QuickAction['category']): QuickAction[] {
  const all = Array.from(_quickActions.values())
  return category ? all.filter(a => a.category === category) : all
}

export function runQuickAction(id: string): void {
  _quickActions.get(id)?.action()
}
