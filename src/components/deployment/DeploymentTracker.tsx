import React from 'react';

function copyableValue(value) {
  return value || '—';
}

export default function DeploymentTracker({ status }) {
  if (!status) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}
      >
        No deployment status
      </div>
    );
  }

  const receipt = status.receipt || status;
  const timeline = receipt.statusHistory || status.statusHistory || [];
  const currentState = status.status || receipt.status || 'pending';
  const isSimulation = Boolean(status.isSimulation || receipt.isSimulation);

  const getStatusColor = (stat) => {
    switch (stat) {
      case 'submitted':
      case 'confirmed':
      case 'complete':
        return 'var(--green)';
      case 'pending':
        return 'var(--amber)';
      case 'failed':
        return 'var(--red)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusIcon = (stat) => {
    switch (stat) {
      case 'submitted':
      case 'confirmed':
      case 'complete':
        return '✅';
      case 'pending':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '📌';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '18px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${getStatusColor(currentState)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '18px' }}>{getStatusIcon(currentState)}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                color: getStatusColor(currentState),
                fontSize: '14px',
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {currentState}
            </span>
            {isSimulation && (
              <span
                style={{
                  fontSize: '10px',
                  background: 'rgba(255, 184, 0, 0.2)',
                  color: 'var(--amber)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                SIMULATION
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {receipt.networkUsed || status.networkUsed || 'testnet'} deployment receipt
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          fontSize: '11px',
        }}
      >
        {receipt.artifactName && (
          <InfoCard label="Artifact" value={receipt.artifactName} />
        )}
        {receipt.contractId && <InfoCard label="Contract ID" value={receipt.contractId} accent="var(--cyan)" />}
        {receipt.txHash && <InfoCard label="Transaction Hash" value={receipt.txHash} />}
        {receipt.sourceAccount && <InfoCard label="Source Account" value={receipt.sourceAccount} />}
        {typeof receipt.constructorArgsCount === 'number' && (
          <InfoCard label="Constructor Args" value={String(receipt.constructorArgsCount)} />
        )}
        {receipt.sizeBytes ? (
          <InfoCard label="Artifact Size" value={`${receipt.sizeMb.toFixed(2)} MB`} />
        ) : null}
        {receipt.artifactHash && (
          <InfoCard label="WASM Hash" value={receipt.artifactHash.slice(0, 24)} mono />
        )}
        {receipt.timestamp && (
          <InfoCard label="Timestamp" value={new Date(receipt.timestamp).toLocaleString()} />
        )}
      </div>

      {timeline.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Deployment Tracking
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {timeline.map((entry, index) => (
              <div
                key={`${entry.id}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '22px 1fr',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '999px',
                    marginTop: '4px',
                    background: getStatusColor(entry.status),
                    boxShadow: '0 0 0 4px rgba(34, 211, 238, 0.12)',
                  }}
                />
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                      {entry.label}
                    </div>
                    <div style={{ fontSize: '10px', color: getStatusColor(entry.status), textTransform: 'capitalize' }}>
                      {entry.status}
                    </div>
                  </div>
                  {entry.detail && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {entry.detail}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {receipt.estimatedCost && (
        <div
          style={{
            padding: '14px',
            background: 'rgba(34, 211, 238, 0.08)',
            border: '1px solid var(--cyan)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700 }}>Receipt Summary</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div>Estimated Fee: {receipt.estimatedCost.estimatedFeeStroops.toLocaleString()} stroops</div>
            <div>Footprint: {receipt.estimatedCost.footprintKb} KB</div>
            <div>Receipt ID: {copyableValue(receipt.receiptId)}</div>
            <div>Network: {receipt.networkUsed}</div>
          </div>
        </div>
      )}

      {(receipt.error || status.error) && (
        <div
          style={{
            padding: '12px',
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--red)',
            fontSize: '11px',
            lineHeight: 1.5,
          }}
        >
          {receipt.error || status.error}
        </div>
      )}

      {(receipt.explorerUrls?.contract || receipt.explorerUrls?.transaction) && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {receipt.explorerUrls.contract && (
            <a
              href={receipt.explorerUrls.contract}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 12px',
                background: 'var(--cyan)',
                color: 'var(--bg-base)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              Open Contract Receipt
            </a>
          )}
          {receipt.explorerUrls.transaction && (
            <a
              href={receipt.explorerUrls.transaction}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 12px',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-bright)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              Open Transaction
            </a>
          )}
        </div>
      )}

      <pre
        style={{
          margin: 0,
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          fontSize: '9px',
          color: 'var(--text-secondary)',
          overflowX: 'auto',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.5,
        }}
      >
        {JSON.stringify(receipt, null, 2)}
      </pre>
    </div>
  );
}

function InfoCard({ label, value, accent, mono = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '10px',
        background: 'var(--bg-base)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          fontSize: '9px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          wordBreak: 'break-all',
          color: accent || 'var(--text-primary)',
          fontWeight: 600,
          fontSize: '10px',
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}
