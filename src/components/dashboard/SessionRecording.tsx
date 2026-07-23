/**
 * SessionRecording Dashboard Component (#410)
 * List, search, replay, and manage recorded sessions.
 */

import React, { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Card from './Card';
import { useSessionRecording, useSessionList, useReplay } from '../../hooks/useSessionRecording';
import { useRBAC } from '../../hooks/useRBAC';
import { Permission } from '../../lib/rbac';
import type { SessionRecording } from '../../lib/sessionRecording';

function formatDuration(ms: number | null) {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    click: 'var(--cyan)', navigation: 'var(--green)', input: 'var(--amber)',
    error: 'var(--red)', network: 'var(--purple)', state_change: 'var(--blue)',
    session_start: 'var(--green)', session_end: 'var(--text-muted)',
  };
  const c = colors[type] ?? 'var(--text-muted)';
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 'var(--radius-sm)', fontSize: 10,
      fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase',
      color: c, border: `1px solid ${c}`, background: `${c}22`,
    }}>
      {type}
    </span>
  );
}

function ReplayPanel({ session, onClose }: { session: SessionRecording; onClose: () => void }) {
  const { cursor, progress, currentEvent, done, next, seek, reset } = useReplay(session);
  const total = session.events.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', width: 600, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Replay: {session.id.slice(0, 20)}…
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
              {cursor}/{total} events
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{ height: '100%', background: 'var(--cyan)', width: `${progress * 100}%`, transition: 'width 0.2s' }} />
        </div>

        {/* Current event */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', minHeight: 70 }}>
          {currentEvent ? (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <EventTypeBadge type={currentEvent.type} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(currentEvent.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {currentEvent.target && (
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  Target: {currentEvent.target}
                </div>
              )}
              {currentEvent.url && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  URL: {currentEvent.url}
                </div>
              )}
              {currentEvent.metadata && Object.keys(currentEvent.metadata).length > 0 && (
                <pre style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
                  {JSON.stringify(currentEvent.metadata, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Press Next to start replay</div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={reset} style={ctrlBtn}>↩ Reset</button>
          <button onClick={next} disabled={done} style={{ ...ctrlBtn, background: done ? 'var(--border)' : 'var(--cyan)', color: done ? 'var(--text-muted)' : 'var(--bg-base)' }}>
            Next →
          </button>
          <input
            type="range" min={0} max={total} value={cursor}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--cyan)' }}
          />
          {done && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>Done</span>}
        </div>

        {/* Event list */}
        <div style={{ overflowY: 'auto', maxHeight: 200, borderTop: '1px solid var(--border)' }}>
          {session.events.map((ev, i) => (
            <div
              key={i}
              onClick={() => seek(i + 1)}
              style={{
                padding: '6px 18px', display: 'flex', gap: 10, alignItems: 'center',
                cursor: 'pointer', background: i + 1 === cursor ? 'var(--cyan-glow-sm)' : 'transparent',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 28, flexShrink: 0 }}>{i + 1}</span>
              <EventTypeBadge type={ev.type} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ev.target || ev.url || ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
};

export default function SessionRecordingDashboard() {
  const { can } = useRBAC();
  const { recording, active, start, stop } = useSessionRecording();
  const [search, setSearch] = useState('');
  const [replaySession, setReplaySession] = useState<SessionRecording | null>(null);
  const { sessions, loading, refresh, remove } = useSessionList({ search: search || undefined });

  const canRecord = can(Permission.SESSION_RECORD);
  const canDelete = can(Permission.SESSION_DELETE);
  const canReplay = can(Permission.SESSION_REPLAY);

  const handleToggle = useCallback(async () => {
    if (recording) {
      await stop();
      await refresh();
    } else {
      await start();
    }
  }, [recording, start, stop, refresh]);

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '7px 10px',
    color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          Session Recording
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Capture and replay user sessions for compliance audit.
        </div>
      </div>

      {/* Record control */}
      {canRecord && (
        <Card title="Recording Control" style={{ marginBottom: 16 }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={handleToggle}
              style={{
                padding: '8px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: recording ? 'var(--red)' : 'var(--cyan)',
                color: 'var(--bg-base)', border: 'none', fontSize: 12, fontWeight: 700,
                fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {recording ? (
                <><span style={{ width: 8, height: 8, background: 'var(--bg-base)', borderRadius: 2, display: 'inline-block' }} /> Stop Recording</>
              ) : (
                <><span style={{ width: 8, height: 8, background: 'var(--bg-base)', borderRadius: '50%', display: 'inline-block' }} /> Start Recording</>
              )}
            </button>
            {recording && active && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--red)', marginRight: 6 }}>●</span>
                {active.events.length} events — {formatDistanceToNow(new Date(active.startedAt), { addSuffix: true })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Session list */}
      <Card
        title={`Recorded Sessions (${sessions.length})`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, width: 200 }}
              placeholder="Search sessions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={refresh} style={{ ...ctrlBtn, whiteSpace: 'nowrap' }}>Refresh</button>
          </div>
        }
      >
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            No sessions recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Session ID', 'User', 'Started', 'Duration', 'Events', 'Tags', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--cyan)' }}>{s.id.slice(0, 20)}…</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{s.userId ? `${s.userId.slice(0, 12)}…` : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(s.startedAt), { addSuffix: true })}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{formatDuration(s.duration)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{s.events.length}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {s.tags.map((t) => (
                        <span key={t} style={{ padding: '1px 6px', fontSize: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginRight: 4 }}>{t}</span>
                      ))}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canReplay && (
                          <button
                            onClick={() => setReplaySession(s)}
                            style={{ padding: '3px 10px', background: 'transparent', border: '1px solid var(--cyan)', color: 'var(--cyan)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11 }}
                          >
                            Replay
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => remove(s.id)}
                            style={{ padding: '3px 10px', background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11 }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {replaySession && (
        <ReplayPanel session={replaySession} onClose={() => setReplaySession(null)} />
      )}
    </div>
  );
}
