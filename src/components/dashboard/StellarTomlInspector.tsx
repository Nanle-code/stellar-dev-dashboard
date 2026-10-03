import React, { useCallback, useState, type FormEvent } from 'react';
import {
  inspectStellarToml,
  exportInspectionAsJson,
  type StellarTomlInspection,
} from '../../lib/stellarTomlInspector';
import type { NetworkName } from '../../lib/stellar';

const controlStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  color: 'var(--text-muted)',
  fontSize: '12px',
  fontWeight: 500,
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  fontSize: '13px',
  color: 'var(--text-primary)',
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: ok ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)',
      }}
    >
      {label}
    </span>
  );
}

function TransportSection({ transport }: { transport: StellarTomlInspection['transport'] }) {
  return (
    <div style={sectionStyle}>
      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>Transport</div>
      <div style={rowStyle}>
        <span>HTTPS</span>
        <StatusPill ok={transport.https} label={transport.https ? 'Yes' : 'No'} />
      </div>
      <div style={rowStyle}>
        <span>CORS header (Access-Control-Allow-Origin)</span>
        <StatusPill ok={transport.corsHeaderPresent} label={transport.corsHeaderValue ?? 'Missing'} />
      </div>
      <div style={rowStyle}>
        <span>Content type</span>
        <span>{transport.contentType ?? 'Not set'}</span>
      </div>
      <div style={rowStyle}>
        <span>Size</span>
        <span>{transport.sizeBytes.toLocaleString()} bytes</span>
      </div>
      <div style={rowStyle}>
        <span>Fetch time</span>
        <span>{transport.fetchDurationMs} ms</span>
      </div>
    </div>
  );
}

function FieldIssuesSection({ issues }: { issues: StellarTomlInspection['fieldIssues'] }) {
  if (issues.length === 0) {
    return (
      <div style={sectionStyle}>
        <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>SEP-1 field validation</div>
        <div style={{ color: 'var(--success, #22c55e)', fontSize: '13px' }}>No field issues found.</div>
      </div>
    );
  }
  return (
    <div style={sectionStyle}>
      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>SEP-1 field validation</div>
      {issues.map((issue, index) => (
        <div key={`${issue.field}-${index}`} style={rowStyle}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{issue.field}</span>
          <span style={{ color: issue.severity === 'error' ? 'var(--danger, #ef4444)' : 'var(--warning, #eab308)' }}>
            {issue.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function EndpointChecksSection({ checks }: { checks: StellarTomlInspection['endpointChecks'] }) {
  if (checks.length === 0) return null;
  return (
    <div style={sectionStyle}>
      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
        Endpoint allowlist checks
      </div>
      {checks.map((check) => (
        <div key={check.field} style={rowStyle}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{check.field}</span>
          <StatusPill
            ok={check.validation.allowed}
            label={check.validation.allowed ? 'Allowed' : check.validation.reason ?? 'Blocked'}
          />
        </div>
      ))}
    </div>
  );
}

function CurrencyChecksSection({ checks }: { checks: StellarTomlInspection['currencyChecks'] }) {
  if (checks.length === 0) return null;
  return (
    <div style={sectionStyle}>
      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
        Currency issuer cross-check (Horizon)
      </div>
      {checks.map((check, index) => (
        <div key={`${check.code}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={rowStyle}>
            <span>{check.code ?? 'Unknown'}</span>
            <StatusPill ok={check.issuerExists} label={check.issuerExists ? 'Issuer found' : 'Issuer not found'} />
          </div>
          {check.mismatchReason && (
            <div style={{ fontSize: '12px', color: 'var(--warning, #eab308)' }}>{check.mismatchReason}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StellarTomlInspector() {
  const [domain, setDomain] = useState('');
  const [network, setNetwork] = useState<NetworkName>('testnet');
  const [result, setResult] = useState<StellarTomlInspection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!domain.trim()) return;
      setIsLoading(true);
      setError(null);
      setResult(null);
      try {
        const inspection = await inspectStellarToml(domain.trim(), network);
        setResult(inspection);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to inspect stellar.toml.');
      } finally {
        setIsLoading(false);
      }
    },
    [domain, network]
  );

  const handleExport = useCallback(() => {
    if (!result) return;
    const json = exportInspectionAsJson(result);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stellar-toml-${result.domain}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      <div>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px' }}>stellar.toml Inspector</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
          Fetch, validate, and debug a domain&rsquo;s SEP-1 stellar.toml file.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ ...labelStyle, flex: 1, minWidth: '220px' }}>
          Home domain
          <input
            style={controlStyle}
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            aria-label="Home domain"
          />
        </label>
        <label style={labelStyle}>
          Network
          <select
            style={controlStyle}
            value={network}
            onChange={(e) => setNetwork(e.target.value as NetworkName)}
            aria-label="Network"
          >
            <option value="mainnet">Mainnet</option>
            <option value="testnet">Testnet</option>
            <option value="futurenet">Futurenet</option>
          </select>
        </label>
        <button type="submit" style={{ ...controlStyle, cursor: 'pointer' }} disabled={isLoading || !domain.trim()}>
          {isLoading ? 'Inspecting…' : 'Inspect'}
        </button>
        {result && (
          <button type="button" style={{ ...controlStyle, cursor: 'pointer' }} onClick={handleExport}>
            Export JSON
          </button>
        )}
      </form>

      {error && (
        <div style={{ ...sectionStyle, borderColor: 'var(--danger, #ef4444)', color: 'var(--danger, #ef4444)' }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div style={rowStyle}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Overall result for {result.domain}
            </span>
            <StatusPill ok={result.isValid} label={result.isValid ? 'Valid' : 'Issues found'} />
          </div>
          <TransportSection transport={result.transport} />
          <FieldIssuesSection issues={result.fieldIssues} />
          <EndpointChecksSection checks={result.endpointChecks} />
          <CurrencyChecksSection checks={result.currencyChecks} />
        </>
      )}
    </div>
  );
}
