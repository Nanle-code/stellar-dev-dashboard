import React, { useState, useCallback } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Clock,
  Shield,
  Database,
  FileText,
  ChevronDown,
  ChevronRight,
  Zap,
  Info,
} from 'lucide-react';
import { analyzeUpgrade } from '../../lib/contractUpgradeAnalysis/upgradeAnalyzer';
import type {
  ContractSpec,
  UpgradeAnalysisResult,
  ChangeRecord,
  MigrationStep,
  CompatibilityDetail,
} from '../../lib/contractUpgradeAnalysis/types';

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

const ELEVATED_STYLE: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '14px',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: '120px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const riskColors: Record<string, string> = {
  low: 'var(--green)',
  medium: 'var(--amber)',
  high: '#f97316',
  critical: 'var(--red)',
};

const gradeColors: Record<string, string> = {
  A: 'var(--green)',
  B: '#22d3ee',
  C: 'var(--amber)',
  D: '#f97316',
  F: 'var(--red)',
};

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={PANEL_STYLE}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>{title}</div>
        {subtitle && (
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '10px',
      fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  return <Badge label={level.toUpperCase()} color={riskColors[level] ?? 'var(--text-muted)'} />;
}

function ChangeItem({ change }: { change: ChangeRecord }) {
  const icon = change.severity === 'breaking'
    ? <XCircle size={14} color="var(--red)" />
    : change.severity === 'deprecation'
      ? <AlertTriangle size={14} color="var(--amber)" />
      : <CheckCircle size={14} color="var(--green)" />;

  return (
    <div style={{
      ...ELEVATED_STYLE,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      marginBottom: '6px',
    }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
          {change.description}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {change.category.replace(/-/g, ' ')}
          {change.affectedFunction && ` — ${change.affectedFunction}`}
        </div>
      </div>
      <Badge label={change.severity} color={riskColors[change.severity] ?? 'var(--text-muted)'} />
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color, fontWeight: 700 }}>{score}%</span>
      </div>
      <div style={{ height: '6px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

function StepCard({ step, expanded, onToggle }: { step: MigrationStep; expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{
      ...ELEVATED_STYLE,
      cursor: 'pointer',
      marginBottom: '6px',
      transition: 'var(--transition)',
    }} onClick={onToggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: step.required ? 'var(--cyan-glow)' : 'var(--bg-base)',
          color: step.required ? 'var(--cyan)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>
          {step.order}
        </span>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {step.title}
        </span>
        <Badge label={step.complexity} color={step.complexity === 'complex' ? 'var(--red)' : step.complexity === 'moderate' ? 'var(--amber)' : 'var(--green)'} />
      </div>
      {expanded && (
        <div style={{ marginTop: '10px', paddingLeft: '44px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
            {step.description}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>~{step.estimatedTimeMinutes} min</span>
            {step.required && <Badge label="required" color="var(--amber)" />}
          </div>
          {step.codeExample && (
            <pre style={{
              marginTop: '8px',
              padding: '10px',
              background: 'var(--bg-base)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              overflow: 'auto',
              lineHeight: 1.5,
            }}>
              {step.codeExample}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const DEMO_BEFORE_SPEC: ContractSpec = {
  specVersion: '1.0.0',
  contractId: 'C_DEMO_BEFORE',
  functions: [
    { name: 'transfer', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'i128' }], outputs: [{ name: 'result', type: 'bool' }], mutability: 'stateful', authRequired: true },
    { name: 'balance', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ name: 'bal', type: 'i128' }], mutability: 'view', authRequired: false },
    { name: 'approve', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'i128' }], outputs: [], mutability: 'stateful', authRequired: true },
  ],
  events: [
    { name: 'Transfer', params: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'i128' }] },
    { name: 'Approval', params: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'i128' }] },
  ],
  errors: [{ name: 'InsufficientBalance', code: 1 }, { name: 'Unauthorized', code: 2 }],
  storageSlots: [
    { name: 'balances', type: 'Map<Address, i128>', persistent: true },
    { name: 'allowances', type: 'Map<Address, Map<Address, i128>>', persistent: true },
    { name: 'total_supply', type: 'i128', persistent: true },
  ],
  metadata: { name: 'TokenContract', version: '1.0.0' },
};

const DEMO_AFTER_SPEC: ContractSpec = {
  specVersion: '1.0.0',
  contractId: 'C_DEMO_BEFORE',
  functions: [
    { name: 'transfer', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'i128' }], outputs: [{ name: 'result', type: 'bool' }], mutability: 'stateful', authRequired: true },
    { name: 'balance', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ name: 'bal', type: 'i128' }], mutability: 'view', authRequired: false },
    { name: 'transfer_from', inputs: [{ name: 'spender', type: 'address' }, { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'i128' }], outputs: [{ name: 'result', type: 'bool' }], mutability: 'stateful', authRequired: true },
  ],
  events: [
    { name: 'Transfer', params: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'i128' }, { name: 'fee', type: 'i128' }] },
  ],
  errors: [{ name: 'InsufficientBalance', code: 1 }],
  storageSlots: [
    { name: 'balances', type: 'Map<Address, i128>', persistent: true },
    { name: 'total_supply', type: 'i128', persistent: true },
    { name: 'fee_bps', type: 'u32', persistent: false },
  ],
  metadata: { name: 'TokenContract', version: '2.0.0' },
};

export default function ContractUpgradeAnalyzer() {
  const [beforeJson, setBeforeJson] = useState('');
  const [afterJson, setAfterJson] = useState('');
  const [beforeBytecodeHex, setBeforeBytecodeHex] = useState('');
  const [afterBytecodeHex, setAfterBytecodeHex] = useState('');
  const [result, setResult] = useState<UpgradeAnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'changes' | 'migration'>('overview');

  const parseSpec = useCallback((json: string): ContractSpec | null => {
    try {
      const parsed = JSON.parse(json);
      return parsed as ContractSpec;
    } catch {
      return null;
    }
  }, []);

  const hexToBytes = useCallback((hex: string): Uint8Array => {
    const cleaned = hex.replace(/^0x/, '').replace(/\s/g, '');
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }, []);

  const handleAnalyze = useCallback(async () => {
    setError('');
    setResult(null);
    setLoading(true);

    const beforeSpec = parseSpec(beforeJson);
    const afterSpec = parseSpec(afterJson);

    if (!beforeSpec) {
      setError('Invalid "before" contract spec JSON');
      setLoading(false);
      return;
    }
    if (!afterSpec) {
      setError('Invalid "after" contract spec JSON');
      setLoading(false);
      return;
    }

    let beforeBytes: Uint8Array;
    let afterBytes: Uint8Array;
    try {
      beforeBytes = beforeBytecodeHex.trim() ? hexToBytes(beforeBytecodeHex) : new Uint8Array(32);
      afterBytes = afterBytecodeHex.trim() ? hexToBytes(afterBytecodeHex) : new Uint8Array(32);
    } catch {
      setError('Invalid bytecode hex');
      setLoading(false);
      return;
    }

    try {
      const analysisResult = await analyzeUpgrade(beforeSpec, afterSpec, beforeBytes, afterBytes);
      setResult(analysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [beforeJson, afterJson, beforeBytecodeHex, afterBytecodeHex, parseSpec, hexToBytes]);

  const handleLoadDemo = useCallback(() => {
    setBeforeJson(JSON.stringify(DEMO_BEFORE_SPEC, null, 2));
    setAfterJson(JSON.stringify(DEMO_AFTER_SPEC, null, 2));
    setBeforeBytecodeHex('0061736d01000000');
    setAfterBytecodeHex('0061736d0100000001000001');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Panel
        title="Contract Upgrade Impact Analysis"
        subtitle="Analyze breaking changes, compatibility, and migration requirements between contract versions."
      >
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button
            onClick={handleLoadDemo}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            Load Demo
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Before (current) — Contract Spec JSON</div>
            <textarea
              value={beforeJson}
              onChange={(e) => setBeforeJson(e.target.value)}
              placeholder='{ "contractId": "C...", "functions": [...], ... }'
              style={TEXTAREA_STYLE}
            />
          </div>
          <div>
            <div style={{ ...LABEL_STYLE, marginBottom: '6px' }}>After (upgrade) — Contract Spec JSON</div>
            <textarea
              value={afterJson}
              onChange={(e) => setAfterJson(e.target.value)}
              placeholder='{ "contractId": "C...", "functions": [...], ... }'
              style={TEXTAREA_STYLE}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Before Bytecode (hex, optional)</div>
            <input
              value={beforeBytecodeHex}
              onChange={(e) => setBeforeBytecodeHex(e.target.value)}
              placeholder="0061736d01..."
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <div style={{ ...LABEL_STYLE, marginBottom: '6px' }}>After Bytecode (hex, optional)</div>
            <input
              value={afterBytecodeHex}
              onChange={(e) => setAfterBytecodeHex(e.target.value)}
              placeholder="0061736d01..."
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !beforeJson.trim() || !afterJson.trim()}
          style={{
            padding: '10px 20px',
            background: loading || !beforeJson.trim() || !afterJson.trim() ? 'var(--bg-elevated)' : 'var(--cyan)',
            color: loading || !beforeJson.trim() || !afterJson.trim() ? 'var(--text-muted)' : 'var(--bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: loading || !beforeJson.trim() || !afterJson.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {loading ? (
            <>
              <div style={{ width: '12px', height: '12px', border: '2px solid var(--bg-base)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Analyzing...
            </>
          ) : (
            <>
              <Search size={14} />
              Analyze Upgrade Impact
            </>
          )}
        </button>

        {error && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,50,50,0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </Panel>

      {result && (
        <>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['overview', 'changes', 'migration'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '7px 14px',
                  background: activeTab === tab ? 'var(--cyan-glow)' : 'transparent',
                  border: `1px solid ${activeTab === tab ? 'var(--cyan-dim)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: activeTab === tab ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <Panel title="Compatibility Score">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: `${gradeColors[result.compatibilityScore.grade]}22`,
                    border: `3px solid ${gradeColors[result.compatibilityScore.grade]}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '24px',
                    color: gradeColors[result.compatibilityScore.grade],
                  }}>
                    {result.compatibilityScore.grade}
                  </div>
                  <div>
                    <div style={{ fontSize: '28px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {result.compatibilityScore.overall}%
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overall Compatibility</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <ScoreBar label="Functions" score={result.compatibilityScore.functionCompat} />
                  <ScoreBar label="Events" score={result.compatibilityScore.eventCompat} />
                  <ScoreBar label="Storage" score={result.compatibilityScore.storageCompat} />
                  <ScoreBar label="Errors" score={result.compatibilityScore.errorCompat} />
                  <ScoreBar label="Bytecode" score={result.compatibilityScore.bytecodeSimilarity} />
                </div>
              </Panel>

              <Panel title="Impact Prediction">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Risk Level</span>
                    <RiskBadge level={result.impactPrediction.overallRisk} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Confidence</span>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {Math.round(result.impactPrediction.confidenceScore * 100)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Affected Users (est.)</span>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ~{result.impactPrediction.affectedUserEstimate}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Affected Integrations (est.)</span>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ~{result.impactPrediction.affectedIntegrationsEstimate}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Migration Complexity</span>
                    <Badge label={result.impactPrediction.estimatedMigrationComplexity} color={riskColors[result.impactPrediction.overallRisk]} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Est. Migration Time</span>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ~{result.impactPrediction.estimatedMigrationTimeHours}h
                    </span>
                  </div>
                  {result.impactPrediction.historicalPatternMatch && (
                    <div style={{ ...ELEVATED_STYLE, fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={12} color="var(--cyan)" />
                      {result.impactPrediction.historicalPatternMatch}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {result.impactPrediction.dataMigrationRequired && <Badge label="Data migration" color="var(--amber)" />}
                    {result.impactPrediction.storageMigrationRequired && <Badge label="Storage migration" color="var(--red)" />}
                    {result.impactPrediction.rollbackFeasible && <Badge label="Rollback feasible" color="var(--green)" />}
                    {!result.impactPrediction.rollbackFeasible && <Badge label="No rollback" color="var(--red)" />}
                  </div>
                  {result.impactPrediction.featuresAffected.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 600 }}>Affected: </span>
                      {result.impactPrediction.featuresAffected.join(', ')}
                    </div>
                  )}
                </div>
              </Panel>

              <Panel title="Summary">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <FileText size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      <strong>{result.abiDiff.removedFunctions.length}</strong> functions removed
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Zap size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      <strong>{result.abiDiff.addedFunctions.length}</strong> functions added
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <AlertTriangle size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      <strong>{result.abiDiff.breakingChanges.length}</strong> breaking changes
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Clock size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      Analysis took <strong>{result.analysisDurationMs}ms</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      v{result.fromVersion} → v{result.toVersion}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Shield size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      Bytecode similarity: <strong>{Math.round(result.bytecodeDiff.similarityScore * 100)}%</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Database size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      Storage changes: <strong>{result.abiDiff.storageChanges.length}</strong>
                    </span>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {activeTab === 'changes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {result.abiDiff.breakingChanges.length > 0 && (
                <Panel title="Breaking Changes" subtitle={`${result.abiDiff.breakingChanges.length} breaking change(s) detected`}>
                  {result.abiDiff.breakingChanges.map((change, i) => (
                    <ChangeItem key={`breaking-${i}`} change={change} />
                  ))}
                </Panel>
              )}
              {result.abiDiff.nonBreakingChanges.length > 0 && (
                <Panel title="Additive Changes" subtitle={`${result.abiDiff.nonBreakingChanges.length} non-breaking change(s)`}>
                  {result.abiDiff.nonBreakingChanges.map((change, i) => (
                    <ChangeItem key={`nonbreaking-${i}`} change={change} />
                  ))}
                </Panel>
              )}
              {result.abiDiff.deprecations.length > 0 && (
                <Panel title="Deprecations" subtitle={`${result.abiDiff.deprecations.length} deprecation(s)`}>
                  {result.abiDiff.deprecations.map((change, i) => (
                    <ChangeItem key={`deprecation-${i}`} change={change} />
                  ))}
                </Panel>
              )}
              {result.compatibilityScore.details.length > 0 && (
                <Panel title="Compatibility Details">
                  {result.compatibilityScore.details.map((detail: CompatibilityDetail, i) => (
                    <div key={i} style={{ ...ELEVATED_STYLE, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ScoreBar label="" score={detail.score} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{detail.area}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{detail.message}</div>
                      </div>
                    </div>
                  ))}
                </Panel>
              )}
            </div>
          )}

          {activeTab === 'migration' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Panel title="Migration Strategy" subtitle={result.migrationRecommendation.overallStrategy}>
                <div style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${riskColors[result.impactPrediction.overallRisk]}`,
                  background: `${riskColors[result.impactPrediction.overallRisk]}11`,
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  marginBottom: '12px',
                }}>
                  {result.migrationRecommendation.overallStrategy}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Estimated total time: <strong>~{result.migrationRecommendation.estimatedTotalTimeMinutes} min</strong></span>
                </div>
              </Panel>

              <Panel title="Pre-Migration Checks">
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.migrationRecommendation.preMigrationChecks.map((check, i) => (
                    <li key={i} style={{ ...ELEVATED_STYLE, fontSize: '12px', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <CheckCircle size={14} color="var(--cyan)" />
                      {check}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Migration Steps" subtitle={`${result.migrationRecommendation.migrationSteps.length} step(s)`}>
                {result.migrationRecommendation.migrationSteps.map((step) => (
                  <StepCard
                    key={step.order}
                    step={step}
                    expanded={expandedStep === step.order}
                    onToggle={() => setExpandedStep(expandedStep === step.order ? null : step.order)}
                  />
                ))}
              </Panel>

              <Panel title="Post-Migration Validation">
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.migrationRecommendation.postMigrationValidation.map((check, i) => (
                    <li key={i} style={{ ...ELEVATED_STYLE, fontSize: '12px', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <CheckCircle size={14} color="var(--green)" />
                      {check}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Rollback Plan">
                <pre style={{
                  margin: 0,
                  padding: '14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {result.migrationRecommendation.rollbackPlan}
                </pre>
              </Panel>

              <Panel title="Risk Mitigation Tips">
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.migrationRecommendation.riskMitigationTips.map((tip, i) => (
                    <li key={i} style={{ ...ELEVATED_STYLE, fontSize: '12px', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <AlertTriangle size={14} color="var(--amber)" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
