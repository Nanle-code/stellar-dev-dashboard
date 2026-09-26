import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  compareFeeStrategiesDryRun,
  type FeeStrategyComparisonReport,
  type FeeStrategyDryRunResult,
  type FeeStrategyTier,
  type CompareFeeStrategiesParams,
} from '../../lib/feeStrategyDryRun';
import { useStore } from '../../lib/store';
import {
  Zap,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  Gauge,
  Check,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface FeeStrategyComparisonPanelProps {
  transactionParams?: {
    sourceAccount?: string;
    operations?: Array<Record<string, unknown>>;
    memo?: string;
    timeBounds?: Record<string, unknown> | null;
    baseFee?: number;
    network?: string;
  };
  accountBalance?: number | string;
  initialCongestion?: number;
  selectedTier?: FeeStrategyTier;
  onSelectStrategy?: (strategy: FeeStrategyDryRunResult) => void;
  onApplyFee?: (baseFee: number, tier: FeeStrategyTier) => void;
}

export default function FeeStrategyComparisonPanel({
  transactionParams: propParams,
  accountBalance,
  initialCongestion = 0.55,
  selectedTier: controlledSelectedTier,
  onSelectStrategy,
  onApplyFee,
}: FeeStrategyComparisonPanelProps) {
  const { connectedAddress, network } = useStore();
  const [congestion, setCongestion] = useState<number>(initialCongestion);
  const [selectedTier, setSelectedTier] = useState<FeeStrategyTier>(controlledSelectedTier || 'medium');
  const [report, setReport] = useState<FeeStrategyComparisonReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showTrace, setShowTrace] = useState<boolean>(false);
  const [showComparisonTable, setShowComparisonTable] = useState<boolean>(true);
  const [customFeeOverrides, setCustomFeeOverrides] = useState<Partial<Record<FeeStrategyTier, number>>>({});
  const [appliedTier, setAppliedTier] = useState<FeeStrategyTier | null>(null);

  const effectiveParams = useMemo<CompareFeeStrategiesParams>(() => {
    return {
      sourceAccount: propParams?.sourceAccount || connectedAddress || '',
      operations: propParams?.operations || [],
      memo: propParams?.memo || '',
      timeBounds: propParams?.timeBounds || null,
      network: propParams?.network || network || 'testnet',
      currentLedgerLoad: congestion,
      accountBalance: accountBalance ?? 10_000_000,
      customFeeOverrides: Object.keys(customFeeOverrides).length ? customFeeOverrides : undefined,
    };
  }, [propParams, connectedAddress, network, congestion, accountBalance, customFeeOverrides]);

  const runComparison = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await compareFeeStrategiesDryRun(effectiveParams);
      setReport(res);
      if (!controlledSelectedTier && res.valid) {
        setSelectedTier(res.recommendedTier);
      }
    } catch (err) {
      console.error('Fee strategy dry-run error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveParams, controlledSelectedTier]);

  useEffect(() => {
    runComparison();
  }, [runComparison]);

  const handleStrategySelect = (strategy: FeeStrategyDryRunResult) => {
    setSelectedTier(strategy.tier);
    if (onSelectStrategy) {
      onSelectStrategy(strategy);
    }
  };

  const handleApplyStrategy = (strategy: FeeStrategyDryRunResult) => {
    setSelectedTier(strategy.tier);
    setAppliedTier(strategy.tier);
    if (onApplyFee) {
      onApplyFee(strategy.baseFee, strategy.tier);
    }
    if (onSelectStrategy) {
      onSelectStrategy(strategy);
    }
  };

  const getLikelihoodColor = (percent: number) => {
    if (percent >= 90) return 'var(--green, #10b981)';
    if (percent >= 75) return 'var(--cyan, #06b6d4)';
    if (percent >= 50) return 'var(--amber, #f59e0b)';
    return 'var(--red, #ef4444)';
  };

  const getTierIcon = (tier: FeeStrategyTier) => {
    switch (tier) {
      case 'low':
        return <Coins size={18} style={{ color: 'var(--cyan, #06b6d4)' }} />;
      case 'medium':
        return <TrendingUp size={18} style={{ color: 'var(--green, #10b981)' }} />;
      case 'high':
        return <Zap size={18} style={{ color: 'var(--purple, #a855f7)' }} />;
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #111827)',
        border: '1px solid var(--border, #1f2937)',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        color: 'var(--text-primary, #f9fafb)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
      data-testid="fee-strategy-comparison-panel"
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border, #1f2937)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-elevated, #1f2937)',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display, inherit)',
              fontWeight: 700,
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Gauge size={18} style={{ color: 'var(--cyan, #06b6d4)' }} />
            Fee Strategy Dry-Run Comparison
          </div>
          <div
            style={{
              marginTop: '4px',
              fontSize: '12px',
              color: 'var(--text-muted, #9ca3af)',
              lineHeight: 1.4,
            }}
          >
            Compare success likelihood, execution cost, and inclusion latency across fee strategies before signing.
          </div>
        </div>

        {report && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '12px',
                background: report.baseSimulationSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${report.baseSimulationSuccess ? 'var(--green, #10b981)' : 'var(--red, #ef4444)'}`,
                color: report.baseSimulationSuccess ? 'var(--green, #10b981)' : 'var(--red, #ef4444)',
                fontWeight: 600,
              }}
            >
              {report.baseSimulationSuccess ? '✓ Simulation Valid' : '✗ Simulation Warning'}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Unsupported Environment or Error Banner */}
        {report?.isUnsupportedEnvironment && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid var(--amber, #f59e0b)',
              color: 'var(--amber, #f59e0b)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
            data-testid="unsupported-environment-banner"
          >
            <AlertTriangle size={18} />
            <div>
              <strong>Environment Warning:</strong> {report.environmentError || 'Unsupported environment detected.'}
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {report && !report.valid && report.validationErrors.length > 0 && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--red, #ef4444)',
              color: 'var(--red, #ef4444)',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
            data-testid="validation-errors-banner"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <AlertCircle size={16} /> Input Validation Required
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
              {report.validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Interactive Network Congestion Simulator */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--bg-elevated, #1f2937)',
            border: '1px solid var(--border, #374151)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <label
              htmlFor="congestion-slider"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary, #d1d5db)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Layers size={14} style={{ color: 'var(--cyan, #06b6d4)' }} />
              Simulated Network Congestion: <strong>{(congestion * 100).toFixed(0)}%</strong>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: congestion > 1.0 ? 'var(--red, #ef4444)' : congestion > 0.6 ? 'var(--amber, #f59e0b)' : 'var(--green, #10b981)',
                }}
              >
                ({congestion > 1.0 ? 'Peak / High Surge' : congestion > 0.6 ? 'Moderate Load' : 'Low Congestion'})
              </span>
            </label>

            {/* Presets */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: 'Low (20%)', value: 0.2 },
                { label: 'Normal (55%)', value: 0.55 },
                { label: 'Peak (110%)', value: 1.1 },
                { label: 'Extreme (140%)', value: 1.4 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setCongestion(preset.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid var(--border, #4b5563)',
                    background: Math.abs(congestion - preset.value) < 0.05 ? 'var(--cyan-glow, rgba(6,182,212,0.2))' : 'transparent',
                    color: Math.abs(congestion - preset.value) < 0.05 ? 'var(--cyan, #06b6d4)' : 'var(--text-muted, #9ca3af)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <input
            id="congestion-slider"
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={congestion}
            onChange={(e) => setCongestion(parseFloat(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
              accentColor: 'var(--cyan, #06b6d4)',
            }}
          />
        </div>

        {/* Strategy Cards Grid */}
        {report && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
            }}
            data-testid="strategy-cards-grid"
          >
            {report.strategyList.map((strategy) => {
              const isSelected = selectedTier === strategy.tier;
              const isApplied = appliedTier === strategy.tier;
              const likelihoodPercent = strategy.successLikelihoodPercent;
              const barColor = getLikelihoodColor(likelihoodPercent);

              return (
                <div
                  key={strategy.tier}
                  onClick={() => handleStrategySelect(strategy)}
                  style={{
                    borderRadius: 'var(--radius-lg, 10px)',
                    border: `2px solid ${isSelected ? 'var(--cyan, #06b6d4)' : 'var(--border, #374151)'}`,
                    background: isSelected ? 'var(--bg-elevated, #1f2937)' : 'var(--bg-surface, #131b2e)',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    position: 'relative',
                    boxShadow: isSelected ? '0 0 16px rgba(6, 182, 212, 0.15)' : 'none',
                  }}
                  data-testid={`strategy-card-${strategy.tier}`}
                >
                  {/* Top Bar: Icon + Title + Recommended Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getTierIcon(strategy.tier)}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{strategy.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)' }}>
                          {strategy.costVsLikelihoodRating}
                        </div>
                      </div>
                    </div>

                    {strategy.isRecommended && (
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '10px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid var(--green, #10b981)',
                          color: 'var(--green, #10b981)',
                          letterSpacing: '0.5px',
                        }}
                      >
                        RECOMMENDED
                      </span>
                    )}
                  </div>

                  {/* Fee Cost Display */}
                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: 'var(--radius-md, 6px)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)' }}>Total Fee</div>
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--text-primary, #ffffff)',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {strategy.totalFee.toLocaleString()} stroops
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--cyan, #06b6d4)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                        {strategy.totalFeeXLM}
                      </div>
                      {strategy.tier !== 'low' && strategy.costDifferenceVsLow.stroops > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #9ca3af)' }}>
                          +{strategy.costDifferenceVsLow.stroops} stroops (+{strategy.costDifferenceVsLow.percentDifference}%)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Success Likelihood Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted, #9ca3af)' }}>Success Likelihood</span>
                      <strong style={{ color: barColor }}>{likelihoodPercent}%</strong>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${likelihoodPercent}%`,
                          height: '100%',
                          background: barColor,
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Inclusion Latency & Resilience */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary, #d1d5db)' }}>
                      <Clock size={13} style={{ color: 'var(--text-muted, #9ca3af)' }} />
                      <span>{strategy.estimatedInclusionTime}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary, #d1d5db)' }}>
                      <ShieldCheck size={13} style={{ color: 'var(--text-muted, #9ca3af)' }} />
                      <span>Resilience: <strong>{strategy.congestionResilience}</strong></span>
                    </div>
                  </div>

                  {/* Warnings if any */}
                  {strategy.warnings.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--amber, #f59e0b)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{strategy.warnings[0]}</span>
                    </div>
                  )}

                  {/* Apply / Select CTA Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyStrategy(strategy);
                    }}
                    style={{
                      marginTop: '4px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md, 6px)',
                      border: isApplied ? '1px solid var(--green, #10b981)' : '1px solid var(--cyan, #06b6d4)',
                      background: isApplied ? 'rgba(16, 185, 129, 0.15)' : isSelected ? 'var(--cyan, #06b6d4)' : 'rgba(6, 182, 212, 0.12)',
                      color: isApplied ? 'var(--green, #10b981)' : isSelected ? '#000000' : 'var(--cyan, #06b6d4)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                    }}
                    data-testid={`apply-strategy-btn-${strategy.tier}`}
                  >
                    {isApplied ? (
                      <>
                        <Check size={14} /> Applied to Builder
                      </>
                    ) : (
                      <>Apply {strategy.label.split(' ')[0]} Fee ({strategy.baseFee} stroops)</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Side-by-Side Comparison Matrix Table Toggle */}
        <div style={{ marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => setShowComparisonTable(!showComparisonTable)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #d1d5db)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
            }}
          >
            {showComparisonTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Side-by-Side Strategy Matrix
          </button>

          {showComparisonTable && report && (
            <div
              style={{
                marginTop: '12px',
                overflowX: 'auto',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border, #374151)',
                background: 'var(--bg-elevated, #1f2937)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, #374151)', background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted, #9ca3af)' }}>Metric</th>
                    <th style={{ padding: '12px 16px', color: 'var(--cyan, #06b6d4)' }}>Low (Economy)</th>
                    <th style={{ padding: '12px 16px', color: 'var(--green, #10b981)' }}>Medium (Standard)</th>
                    <th style={{ padding: '12px 16px', color: 'var(--purple, #a855f7)' }}>High (Priority)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border, #374151)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>Base Fee / Op</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono, monospace)' }}>{report.strategies.low.baseFee} stroops</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono, monospace)' }}>{report.strategies.medium.baseFee} stroops</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono, monospace)' }}>{report.strategies.high.baseFee} stroops</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border, #374151)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>Total Cost</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono, monospace)' }}>{report.strategies.low.totalFeeXLM}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono, monospace)' }}>{report.strategies.medium.totalFeeXLM}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono, monospace)' }}>{report.strategies.high.totalFeeXLM}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border, #374151)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>Success Likelihood</td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: getLikelihoodColor(report.strategies.low.successLikelihoodPercent) }}>
                      {report.strategies.low.successLikelihoodPercent}%
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: getLikelihoodColor(report.strategies.medium.successLikelihoodPercent) }}>
                      {report.strategies.medium.successLikelihoodPercent}%
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: getLikelihoodColor(report.strategies.high.successLikelihoodPercent) }}>
                      {report.strategies.high.successLikelihoodPercent}%
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border, #374151)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>Estimated Inclusion</td>
                    <td style={{ padding: '10px 16px' }}>{report.strategies.low.estimatedInclusionTime}</td>
                    <td style={{ padding: '10px 16px' }}>{report.strategies.medium.estimatedInclusionTime}</td>
                    <td style={{ padding: '10px 16px' }}>{report.strategies.high.estimatedInclusionTime}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>Congestion Resilience</td>
                    <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{report.strategies.low.congestionResilience}</td>
                    <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{report.strategies.medium.congestionResilience}</td>
                    <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{report.strategies.high.congestionResilience}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Execution Trace Toggle */}
        {report && report.executionTrace && report.executionTrace.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowTrace(!showTrace)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #d1d5db)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 0,
              }}
            >
              {showTrace ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Simulation Execution Trace ({report.executionTrace.length} steps)
            </button>

            {showTrace && (
              <div
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {report.executionTrace.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      background: 'var(--bg-elevated, #1f2937)',
                      border: '1px solid var(--border, #374151)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    {step.status === 'ok' ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--green, #10b981)', flexShrink: 0 }} />
                    ) : step.status === 'warning' ? (
                      <AlertTriangle size={16} style={{ color: 'var(--amber, #f59e0b)', flexShrink: 0 }} />
                    ) : (
                      <AlertCircle size={16} style={{ color: 'var(--red, #ef4444)', flexShrink: 0 }} />
                    )}
                    <div>
                      <strong>{step.step}:</strong> {step.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
