import React, { useState, useEffect, useCallback } from 'react'
import {
  IS_DEV, getToolbarState, setToolbarState, subscribeToolbar,
  getRenderTraces, getSlowRenders, clearRenderTraces,
  takeHeapSnapshot, getHeapSnapshots,
  getShortcuts, installShortcutListener, registerShortcut,
  registerQuickAction, getQuickActions, type DevPanel,
} from '../../utils/devExperience'
import { toggleToolbar } from '../../utils/devExperience'

function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
}

function SectionTitle({ label }: { label: string }) {
  return <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
}

function ProfilerPanel() {
  const [traces, setTraces] = useState(getRenderTraces())
  const slow = getSlowRenders(16)
  useEffect(() => {
    const id = setInterval(() => setTraces(getRenderTraces()), 2000)
    return () => clearInterval(id)
  }, [])
  return (
    <Panel>
      <SectionTitle label="React Profiler" />
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{traces.length}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total renders</div>
        </div>
        <div style={{ flex: 1, background: slow.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-elevated)', border: slow.length > 0 ? '1px solid var(--red)' : 'none', borderRadius: 'var(--radius-sm)', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: slow.length > 0 ? 'var(--red)' : undefined }}>{slow.length}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Slow (&gt;16ms)</div>
        </div>
      </div>
      <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {traces.slice(-20).reverse().map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', background: t.actualDurationMs > 16 ? 'rgba(239,68,68,0.06)' : 'var(--bg-elevated)' }}>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{t.id} ({t.phase})</span>
            <span style={{ color: t.actualDurationMs > 16 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{t.actualDurationMs.toFixed(1)}ms</span>
          </div>
        ))}
        {traces.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '12px' }}>No render traces yet — wrap components with &lt;Profiler&gt;</div>}
      </div>
      <button onClick={() => { clearRenderTraces(); setTraces([]) }} style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}>Clear traces</button>
    </Panel>
  )
}

function MemoryPanel() {
  const [snapshots, setSnapshots] = useState(getHeapSnapshots())
  const take = useCallback(() => {
    takeHeapSnapshot()
    setSnapshots(getHeapSnapshots())
  }, [])
  useEffect(() => {
    take()
    const id = setInterval(take, 5000)
    return () => clearInterval(id)
  }, [take])
  const latest = snapshots[snapshots.length - 1]
  return (
    <Panel>
      <SectionTitle label="Memory Profiler" />
      {latest ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[['Used', `${latest.usedJSHeapSizeMb} MB`, latest.usagePercent > 80 ? 'var(--red)' : 'var(--green)'], ['Total', `${latest.totalJSHeapSizeMb} MB`, undefined], ['Limit', `${latest.jsHeapSizeLimitMb} MB`, undefined]].map(([l, v, c]) => (
              <div key={String(l)} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: c as string | undefined }}>{v}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${latest.usagePercent}%`, background: latest.usagePercent > 80 ? 'var(--red)' : 'var(--cyan)', transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>{latest.usagePercent}% heap usage · {snapshots.length} snapshots</div>
        </>
      ) : <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>performance.memory not available</div>}
    </Panel>
  )
}

function ShortcutsPanel() {
  const shortcuts = getShortcuts()
  return (
    <Panel>
      <SectionTitle label="Keyboard Shortcuts" />
      {shortcuts.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No shortcuts registered</div>}
      {shortcuts.map(s => (
        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{s.description}</span>
          <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '3px', padding: '2px 6px', fontSize: '10px' }}>{s.keys.join('+')}</kbd>
        </div>
      ))}
    </Panel>
  )
}

function QuickActionsPanel() {
  const actions = getQuickActions()
  return (
    <Panel>
      <SectionTitle label="Quick Actions" />
      {actions.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No quick actions registered</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
        {actions.map(a => (
          <button key={a.id} onClick={a.action} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {a.icon && <span>{a.icon}</span>}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

const PANELS: { id: DevPanel; label: string; emoji: string }[] = [
  { id: 'profiler', label: 'Profiler', emoji: '⚡' },
  { id: 'memory', label: 'Memory', emoji: '🧠' },
  { id: 'shortcuts', label: 'Shortcuts', emoji: '⌨️' },
  { id: 'state', label: 'Quick Actions', emoji: '🚀' },
]

export default function DevToolbar() {
  const [state, setState] = useState(getToolbarState())

  useEffect(() => {
    const unsub = subscribeToolbar(setState)
    // Register default shortcut to toggle toolbar
    const unreg = registerShortcut({
      id: 'dev.toggle-toolbar',
      keys: ['ctrl', 'shift', 'd'],
      description: 'Toggle Dev Toolbar',
      handler: toggleToolbar,
      devOnly: true,
    })
    // Register quick actions
    const unreg2 = registerQuickAction({ id: 'qa.reload', label: 'Reload Page', icon: '🔄', action: () => window.location.reload(), category: 'debug' })
    const unreg3 = registerQuickAction({ id: 'qa.clear-storage', label: 'Clear LocalStorage', icon: '🗑️', action: () => { if (confirm('Clear localStorage?')) localStorage.clear() }, category: 'debug' })
    const unreg4 = registerQuickAction({ id: 'qa.copy-state', label: 'Copy App State', icon: '📋', action: () => { navigator.clipboard.writeText(JSON.stringify(localStorage, null, 2)).catch(() => {}) }, category: 'debug' })

    const unlistenShortcuts = installShortcutListener()
    return () => { unsub(); unreg(); unreg2(); unreg3(); unreg4(); unlistenShortcuts() }
  }, [])

  if (!IS_DEV || !state.visible) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: state.pinned ? '320px' : '280px',
        background: 'rgba(10, 12, 20, 0.97)',
        borderTop: '1px solid var(--cyan-dim)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(6,182,212,0.06)' }}>
        <span style={{ color: 'var(--cyan)', fontWeight: 700, fontSize: '11px' }}>⚙ DEV TOOLS</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {PANELS.map(p => (
            <button key={p.id} onClick={() => setToolbarState({ activePanel: p.id })} style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: state.activePanel === p.id ? 'var(--cyan-glow)' : 'transparent', color: state.activePanel === p.id ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setToolbarState({ pinned: !state.pinned })} title="Pin toolbar" style={{ background: 'none', border: 'none', color: state.pinned ? 'var(--cyan)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>📌</button>
        <button onClick={() => setToolbarState({ visible: false })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>✕</button>
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {state.activePanel === 'profiler' && <ProfilerPanel />}
        {state.activePanel === 'memory' && <MemoryPanel />}
        {state.activePanel === 'shortcuts' && <ShortcutsPanel />}
        {state.activePanel === 'state' && <QuickActionsPanel />}
      </div>
    </div>
  )
}
