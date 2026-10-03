/**
 * Feature Flags dashboard (#819)
 * Manage create / activate / evaluate / expire / retire with audit history.
 */
import React, { useCallback, useMemo, useState } from 'react';
import Card from './Card';
import {
  FeatureFlagError,
  getFeatureFlagLifecycleService,
  type FeatureFlag,
  type FeatureFlagAuditEntry,
  type FeatureFlagEnvironment,
  type FeatureFlagStatus,
} from '../../lib/featureFlagLifecycle';

const ENVIRONMENTS: FeatureFlagEnvironment[] = ['development', 'staging', 'production', 'test'];

const STATUS_COLOR: Record<FeatureFlagStatus, string> = {
  draft: 'var(--text-muted)',
  active: 'var(--green)',
  expired: 'var(--amber)',
  retired: 'var(--red)',
};

function StatusBadge({ status }: { status: FeatureFlagStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color,
        border: `1px solid ${color}`,
        background: `${color}22`,
      }}
    >
      {status}
    </span>
  );
}

export default function FeatureFlags() {
  const service = useMemo(() => getFeatureFlagLifecycleService(), []);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const flags: FeatureFlag[] = useMemo(() => {
    void tick;
    return service.list();
  }, [service, tick]);

  const audit: FeatureFlagAuditEntry[] = useMemo(() => {
    void tick;
    return service.getAuditHistory(undefined, 40);
  }, [service, tick]);

  const [form, setForm] = useState({
    key: '',
    name: '',
    description: '',
    environments: ['development', 'test'] as FeatureFlagEnvironment[],
    rolloutPercent: '100',
    expiresAt: '',
    allowlist: '',
  });
  const [evalForm, setEvalForm] = useState({
    key: '',
    environment: 'development' as FeatureFlagEnvironment,
    subjectId: 'demo-user',
  });
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [evalResult, setEvalResult] = useState<string>('');
  const [remoteAIEnabled, setRemoteAIEnabled] = useState<boolean | null>(null);
  const [operatorToken, setOperatorToken] = useState('');
  const [aiReason, setAIReason] = useState('');
  const [aiControlBusy, setAIControlBusy] = useState(false);
  const [aiControlMessage, setAIControlMessage] = useState('');
  const [remoteAudit, setRemoteAudit] = useState<
    Array<{
      enabled: boolean;
      previousEnabled: boolean;
      updatedAt: string;
      actor: string;
      reason: string;
    }>
  >([]);

  const refreshAIControl = useCallback(async () => {
    try {
      const [statusResponse, auditResponse] = await Promise.all([
        fetch('/api/v1/ai-controls', { cache: 'no-store' }),
        fetch('/api/v1/ai-controls/audit', { cache: 'no-store' }),
      ]);
      if (!statusResponse.ok || !auditResponse.ok)
        throw new Error('Runtime controls unavailable; check API and shared-store configuration.');
      const status = await statusResponse.json();
      const auditPayload = await auditResponse.json();
      if (typeof status?.data?.enabled !== 'boolean' || !Array.isArray(auditPayload?.data))
        throw new Error('Invalid runtime control response.');
      setRemoteAIEnabled(status.data.enabled);
      setRemoteAudit(auditPayload.data);
      setAIControlMessage('');
    } catch (error) {
      setRemoteAIEnabled(null);
      setAIControlMessage(error instanceof Error ? error.message : 'Runtime controls unavailable.');
    }
  }, []);

  React.useEffect(() => {
    void refreshAIControl();
  }, [refreshAIControl]);

  const setGlobalAIEnabled = async (enabled: boolean) => {
    setAIControlBusy(true);
    setAIControlMessage('');
    try {
      const response = await fetch('/api/v1/ai-controls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({ enabled, reason: aiReason }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.message || `Control update failed (${response.status}).`);
      setRemoteAIEnabled(payload.data.enabled);
      setOperatorToken('');
      setAIReason('');
      setAIControlMessage(`Global AI panels ${enabled ? 'enabled' : 'disabled'}.`);
      await refreshAIControl();
    } catch (error) {
      setAIControlMessage(error instanceof Error ? error.message : 'Control update failed.');
    } finally {
      setAIControlBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '7px 10px',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const btnStyle = (primary = false): React.CSSProperties => ({
    padding: '7px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${primary ? 'var(--cyan)' : 'var(--border)'}`,
    background: primary ? 'var(--cyan-glow-sm)' : 'var(--bg-elevated)',
    color: primary ? 'var(--cyan)' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  });

  const showError = (err: unknown) => {
    const text =
      err instanceof FeatureFlagError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    setMessage({ type: 'err', text });
  };

  const toggleEnv = (env: FeatureFlagEnvironment) => {
    setForm((prev) => {
      const has = prev.environments.includes(env);
      const environments = has
        ? prev.environments.filter((e) => e !== env)
        : [...prev.environments, env];
      return { ...prev, environments };
    });
  };

  const handleCreate = () => {
    setMessage(null);
    try {
      const rollout = Number(form.rolloutPercent);
      const flag = service.create(
        {
          key: form.key.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          environments: form.environments,
          rolloutPercent: rollout,
          expiresAt: form.expiresAt.trim() || null,
          allowlist: form.allowlist
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        'dashboard-ui'
      );
      setMessage({ type: 'ok', text: `Created draft flag "${flag.key}"` });
      setForm({
        key: '',
        name: '',
        description: '',
        environments: ['development', 'test'],
        rolloutPercent: '100',
        expiresAt: '',
        allowlist: '',
      });
      refresh();
    } catch (err) {
      showError(err);
    }
  };

  const runAction = (action: 'activate' | 'expire' | 'retire', key: string) => {
    setMessage(null);
    try {
      const flag = service[action](key, 'dashboard-ui');
      setMessage({ type: 'ok', text: `${action} → ${flag.key} (${flag.status})` });
      refresh();
    } catch (err) {
      showError(err);
    }
  };

  const handleEvaluate = () => {
    setMessage(null);
    try {
      const result = service.evaluate(evalForm.key.trim(), {
        environment: evalForm.environment,
        subjectId: evalForm.subjectId.trim() || undefined,
        actor: 'dashboard-ui',
      });
      setEvalResult(
        `${result.enabled ? 'ENABLED' : 'DISABLED'} — ${result.reason}` +
          (result.flag ? ` [${result.flag.status}]` : '')
      );
      refresh();
    } catch (err) {
      showError(err);
      setEvalResult('');
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 960 }}>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          Feature Flags
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Lifecycle management with audit history — create, evaluate, expire, and retire flags
          across dashboard modules.
        </div>
      </div>

      <Card title="Global AI panel kill switch">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            role="status"
            aria-live="polite"
            style={{
              color:
                remoteAIEnabled === null
                  ? 'var(--amber)'
                  : remoteAIEnabled
                    ? 'var(--green)'
                    : 'var(--red)',
            }}
          >
            {remoteAIEnabled === null
              ? 'Status unavailable (panels fail closed)'
              : `AI panels ${remoteAIEnabled ? 'enabled' : 'disabled'}`}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            This server-controlled switch applies globally without redeploying. Enter the configured
            operator token to change it; credentials are held only in this form and are never
            stored.
          </p>
          <input
            type="password"
            autoComplete="off"
            style={inputStyle}
            placeholder="Operator token"
            aria-label="Operator token"
            value={operatorToken}
            onChange={(event) => setOperatorToken(event.target.value)}
          />
          <input
            style={inputStyle}
            maxLength={240}
            placeholder="Reason for audit history (optional)"
            aria-label="Reason for AI control change"
            value={aiReason}
            onChange={(event) => setAIReason(event.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={btnStyle()}
              disabled={aiControlBusy || !operatorToken || remoteAIEnabled === false}
              onClick={() => void setGlobalAIEnabled(false)}
            >
              Disable all AI panels
            </button>
            <button
              type="button"
              style={btnStyle(true)}
              disabled={aiControlBusy || !operatorToken || remoteAIEnabled === true}
              onClick={() => void setGlobalAIEnabled(true)}
            >
              Re-enable AI panels
            </button>
            <button type="button" style={btnStyle()} onClick={() => void refreshAIControl()}>
              Refresh status
            </button>
          </div>
          {aiControlMessage && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: 12,
                color:
                  aiControlMessage.includes('unavailable') || aiControlMessage.includes('failed')
                    ? 'var(--red)'
                    : 'var(--text-muted)',
              }}
            >
              {aiControlMessage}
            </div>
          )}
          {remoteAudit.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              <strong>Recent global switch changes</strong>
              {remoteAudit.slice(0, 10).map((entry, index) => (
                <div key={`${entry.updatedAt}-${index}`}>
                  {new Date(entry.updatedAt).toLocaleString()} ·{' '}
                  {entry.previousEnabled ? 'enabled' : 'disabled'} →{' '}
                  {entry.enabled ? 'enabled' : 'disabled'} · {entry.actor}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      {message && (
        <div
          style={{
            marginBottom: 14,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            border: `1px solid ${message.type === 'ok' ? 'var(--green)' : 'var(--red)'}`,
            background: message.type === 'ok' ? 'var(--green-glow-sm)' : 'var(--red-glow-sm, #311)',
            color: message.type === 'ok' ? 'var(--green)' : 'var(--red)',
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title="Create Flag">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              style={inputStyle}
              placeholder="key (e.g. fee-forecast-v2)"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Display name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ENVIRONMENTS.map((env) => (
                <label
                  key={env}
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.environments.includes(env)}
                    onChange={() => toggleEnv(env)}
                  />
                  {env}
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                style={inputStyle}
                placeholder="Rollout %"
                value={form.rolloutPercent}
                onChange={(e) => setForm({ ...form, rolloutPercent: e.target.value })}
              />
              <input
                style={inputStyle}
                placeholder="expiresAt ISO (optional)"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <input
              style={inputStyle}
              placeholder="Allowlist subjects (comma-separated)"
              value={form.allowlist}
              onChange={(e) => setForm({ ...form, allowlist: e.target.value })}
            />
            <button type="button" style={btnStyle(true)} onClick={handleCreate}>
              Create draft
            </button>
          </div>
        </Card>

        <Card title="Evaluate">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              style={inputStyle}
              placeholder="Flag key"
              value={evalForm.key}
              onChange={(e) => setEvalForm({ ...evalForm, key: e.target.value })}
              list="flag-keys"
            />
            <datalist id="flag-keys">
              {flags.map((f) => (
                <option key={f.id} value={f.key} />
              ))}
            </datalist>
            <select
              style={inputStyle}
              value={evalForm.environment}
              onChange={(e) =>
                setEvalForm({
                  ...evalForm,
                  environment: e.target.value as FeatureFlagEnvironment,
                })
              }
            >
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
            <input
              style={inputStyle}
              placeholder="Subject id"
              value={evalForm.subjectId}
              onChange={(e) => setEvalForm({ ...evalForm, subjectId: e.target.value })}
            />
            <button type="button" style={btnStyle(true)} onClick={handleEvaluate}>
              Evaluate
            </button>
            {evalResult && (
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                }}
              >
                {evalResult}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title={`Flags (${flags.length})`}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flags.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
              No flags yet. Create a draft to start the lifecycle.
            </div>
          )}
          {flags.map((flag) => (
            <div
              key={flag.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    {flag.key}
                  </span>
                  <StatusBadge status={flag.status} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {flag.name} · rollout {flag.rolloutPercent ?? 100}% ·{' '}
                  {flag.environments.join(', ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  style={btnStyle()}
                  onClick={() => runAction('activate', flag.key)}
                >
                  Activate
                </button>
                <button
                  type="button"
                  style={btnStyle()}
                  onClick={() => runAction('expire', flag.key)}
                >
                  Expire
                </button>
                <button
                  type="button"
                  style={btnStyle()}
                  onClick={() => runAction('retire', flag.key)}
                >
                  Retire
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Audit history">
        <div style={{ padding: 12, maxHeight: 280, overflow: 'auto' }}>
          {audit.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No audit events yet.</div>
          )}
          {audit.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 90px 1fr',
                gap: 8,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
                color: entry.success ? 'var(--text-muted)' : 'var(--red)',
              }}
            >
              <span>{new Date(entry.at).toLocaleString()}</span>
              <span style={{ color: 'var(--cyan)' }}>{entry.action}</span>
              <span>
                {entry.flagKey}
                {entry.detail ? ` — ${entry.detail}` : ''}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
