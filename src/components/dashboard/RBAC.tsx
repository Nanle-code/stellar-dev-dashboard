/**
 * RBAC Dashboard Component (#410)
 * Role assignment UI: view current assignments, assign/revoke roles.
 */

import React, { useState, useCallback } from 'react';
import Card from './Card';
import { useRBAC } from '../../hooks/useRBAC';
import { Role, Permission, getRoleHierarchy, getPermissions } from '../../lib/rbac';

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'var(--red)',
  admin: 'var(--amber)',
  operator: 'var(--cyan)',
  analyst: 'var(--green)',
  viewer: 'var(--text-muted)',
};

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? 'var(--text-muted)';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: '10px',
      fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
      letterSpacing: '0.5px', color, border: `1px solid ${color}`,
      background: `${color}22`,
    }}>
      {role.replace('_', ' ')}
    </span>
  );
}

export default function RBACDashboard() {
  const { role, userId, can, hierarchy, assignments, assign, revoke } = useRBAC();
  const [tab, setTab] = useState<'assignments' | 'permissions'>('assignments');
  const [form, setForm] = useState({ userId: '', role: Role.VIEWER, reason: '' });
  const [success, setSuccess] = useState('');

  const canAssign = can(Permission.RBAC_ASSIGN);

  const handleAssign = useCallback(() => {
    if (!form.userId) return;
    assign({
      userId: form.userId,
      role: form.role as Role,
      assignedBy: userId ?? 'unknown',
      assignedAt: new Date().toISOString(),
      reason: form.reason || undefined,
    });
    setForm({ userId: '', role: Role.VIEWER, reason: '' });
    setSuccess(`Role "${form.role}" assigned to ${form.userId.slice(0, 12)}…`);
    setTimeout(() => setSuccess(''), 3000);
  }, [form, assign, userId]);

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '7px 10px',
    color: 'var(--text-primary)', fontSize: '12px',
    fontFamily: 'var(--font-mono)', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
    fontWeight: active ? 600 : 400, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
    background: active ? 'var(--cyan-glow-sm)' : 'var(--bg-elevated)',
    color: active ? 'var(--cyan)' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  });

  return (
    <div style={{ padding: '20px', maxWidth: 900 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          Role-Based Access Control
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Current role: <RoleBadge role={role} /> {userId && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{userId.slice(0, 16)}…</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button style={btnStyle(tab === 'assignments')} onClick={() => setTab('assignments')}>Assignments</button>
        <button style={btnStyle(tab === 'permissions')} onClick={() => setTab('permissions')}>Permissions</button>
      </div>

      {tab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Assign role */}
          {canAssign && (
            <Card title="Assign Role">
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {success && (
                  <div style={{ padding: '8px 12px', background: 'var(--green-glow-sm)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--green)' }}>
                    {success}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>User ID / Address</div>
                    <input
                      style={inputStyle}
                      placeholder="G... or user ID"
                      value={form.userId}
                      onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
                    <select
                      style={{ ...inputStyle }}
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                    >
                      {hierarchy.map((r) => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Reason (optional)</div>
                    <input
                      style={inputStyle}
                      placeholder="Reason for assignment"
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleAssign}
                    disabled={!form.userId}
                    style={{
                      padding: '8px 18px', borderRadius: 'var(--radius-sm)', cursor: form.userId ? 'pointer' : 'not-allowed',
                      background: form.userId ? 'var(--cyan)' : 'var(--border)', color: 'var(--bg-base)',
                      border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Assign Role
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Existing assignments */}
          <Card title={`Active Assignments (${assignments.length})`}>
            {assignments.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                No role assignments yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['User', 'Role', 'Assigned By', 'Assigned At', 'Reason', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.userId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{a.userId.slice(0, 16)}…</td>
                        <td style={{ padding: '10px 12px' }}><RoleBadge role={a.role} /></td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{a.assignedBy.slice(0, 12)}…</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(a.assignedAt).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{a.reason ?? '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {canAssign && (
                            <button
                              onClick={() => revoke(a.userId)}
                              style={{ padding: '3px 10px', background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11 }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'permissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {getRoleHierarchy().map((r) => (
            <Card key={r} title={<span><RoleBadge role={r} /></span>}>
              <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {getPermissions(r).map((p) => (
                  <span key={p} style={{
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 10,
                    background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
                  }}>{p}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
