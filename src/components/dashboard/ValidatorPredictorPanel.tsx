import React, { useState, useMemo } from 'react';
import {
  getValidatorsWithHistory,
  scoreValidator,
  generatePerformanceReport,
  CustomScoringCriteria,
  StellarValidator,
} from '../../lib/validatorPredictor';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  Shield,
  Clock,
  Globe,
  Settings,
  AlertTriangle,
  FileText,
  Download,
  Info,
  Sliders,
  CheckCircle,
} from 'lucide-react';
import Card from './Card';

export default function ValidatorPredictorPanel() {
  // State for user configuration
  const [criteria, setCriteria] = useState<CustomScoringCriteria>({
    participationWeight: 0.4,
    latencyWeight: 0.3,
    decentralizationWeight: 0.2,
    consistencyWeight: 0.1,
  });

  const [selectedValidatorId, setSelectedValidatorId] = useState<string>('1');

  // Load validators with generated history
  const validators = useMemo(() => getValidatorsWithHistory(), []);

  // Compute scores and details for all validators
  const scoredValidators = useMemo(() => {
    return validators
      .map((v) => ({
        validator: v,
        scoreDetails: scoreValidator(v, criteria),
      }))
      .sort((a, b) => b.scoreDetails.weightedScore - a.scoreDetails.weightedScore);
  }, [validators, criteria]);

  // Selected validator details
  const selectedRecord = useMemo(() => {
    const v = validators.find((val) => val.id === selectedValidatorId);
    if (!v) return null;
    return {
      validator: v,
      report: generatePerformanceReport(v, criteria),
    };
  }, [validators, selectedValidatorId, criteria]);

  // Adjust sliders helper
  const handleWeightChange = (key: keyof CustomScoringCriteria, val: number) => {
    setCriteria((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleExportReport = () => {
    if (!selectedRecord) return;
    const { report, validator } = selectedRecord;
    const reportText = `
==================================================
STELLAR VALIDATOR BEHAVIOR REPORT
==================================================
Generated on: ${new Date().toLocaleString()}
Validator Name: ${validator.name}
Operator: ${validator.operator}
Country/Region: ${validator.region} (${validator.country})
Current Protocol: ${validator.protocolVersion}

--------------------------------------------------
PERFORMANCE SUMMARY
--------------------------------------------------
Overall Quality Score: ${report.scoreExplanation.weightedScore}/100
Ranking Tier: [Tier ${report.scoreExplanation.rankingTier}]
Average Network Ping: ${report.averageLatency.toFixed(1)} ms
Quorum/Voting Power: ${validator.votingPower}%

Scoring Breakdown (Custom Criteria Weights):
- Uptime & Participation: ${report.scoreExplanation.participationScore}/100
- Latency Profile: ${report.scoreExplanation.latencyScore}/100
- Decentralization Contribution: ${report.scoreExplanation.decentralizationScore}/100
- Operational Consistency: ${report.scoreExplanation.consistencyScore}/100

--------------------------------------------------
WEEKLY PERFORMANCE PREDICTION (Next 7 Days)
--------------------------------------------------
Accuracy Horizon Confidence: ${report.predictionAccuracy}%
${report.weeklyPrediction
  .map(
    (p) =>
      `- ${p.dateStr}: Est. Participation: ${p.predictedParticipation}%, Est. Ping: ${p.predictedPing} ms, Risk Profile: ${p.riskProbability}%`
  )
  .join('\n')}

--------------------------------------------------
ANOMALY LOG (Past 30 Days)
--------------------------------------------------
Total Anomalies Flagged: ${report.anomaliesFound.length}
${report.anomaliesFound
  .map((a) => `[${a.date}] Severity: ${a.severity.toUpperCase()} - ${a.description}`)
  .join('\n') || 'No anomalies found in the analyzed history.'}

--------------------------------------------------
STAKING & TRUST RECOMMENDATION
--------------------------------------------------
Recommendation: ${report.recommendation}

==================================================
End of Report
`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ValidatorReport_${validator.name.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        color: 'var(--text-primary)',
        animation: 'fadeIn var(--transition-speed-normal) ease',
      }}
    >
      {/* Title & Introduction */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              margin: 0,
            }}
          >
            Predictive Validator Behavior Analysis
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            AI-driven forecasting and scoring to evaluate Stellar validators for trust quorums and staking decisions.
          </p>
        </div>

        {/* Global badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--cyan-glow)',
            border: '1px solid var(--cyan-dim)',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--cyan)',
          }}
        >
          <Activity size={14} className="pulse" />
          Predictive Horizon: 7 Days (98.2% Active)
        </div>
      </div>

      {/* Main Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 1.8fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Criteria & Rankings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Custom Weight Sliders */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sliders size={18} color="var(--cyan)" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Custom Scoring Weights</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Uptime & Participation ({Math.round(criteria.participationWeight * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={criteria.participationWeight}
                  onChange={(e) => handleWeightChange('participationWeight', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Latency & Ping Efficiency ({Math.round(criteria.latencyWeight * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={criteria.latencyWeight}
                  onChange={(e) => handleWeightChange('latencyWeight', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Decentralization Contribution ({Math.round(criteria.decentralizationWeight * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={criteria.decentralizationWeight}
                  onChange={(e) => handleWeightChange('decentralizationWeight', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Operational Consistency ({Math.round(criteria.consistencyWeight * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={criteria.consistencyWeight}
                  onChange={(e) => handleWeightChange('consistencyWeight', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
              </div>
            </div>
          </Card>

          {/* Ranking & Rankings List */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="var(--green)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Weighted Validator Rankings</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated dynamically</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {scoredValidators.map(({ validator, scoreDetails }, idx) => {
                const isSelected = validator.id === selectedValidatorId;
                const isUnderperforming = scoreDetails.weightedScore < 75;

                return (
                  <div
                    key={validator.id}
                    onClick={() => setSelectedValidatorId(validator.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--bg-hover)' : 'var(--bg-card)',
                      border: isSelected ? '1px solid var(--cyan)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          fontWeight: 700,
                          width: '16px',
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{validator.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{validator.operator}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isUnderperforming && (
                        <span
                          title="Underperforming (Weighted score < 75%)"
                          style={{ color: 'var(--red)', display: 'flex', alignItems: 'center' }}
                        >
                          <AlertTriangle size={14} />
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: scoreDetails.weightedScore >= 90
                            ? 'rgba(0, 230, 118, 0.1)'
                            : scoreDetails.weightedScore >= 75
                            ? 'rgba(255, 179, 0, 0.1)'
                            : 'rgba(255, 23, 68, 0.1)',
                          color: scoreDetails.weightedScore >= 90
                            ? 'var(--green)'
                            : scoreDetails.weightedScore >= 75
                            ? 'var(--amber)'
                            : 'var(--red)',
                        }}
                      >
                        {scoreDetails.weightedScore}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Analytics, Prediction Horizon, Report */}
        {selectedRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Validator Details & Score Explanation */}
            <Card>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '16px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                    {selectedRecord.validator.name}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedRecord.validator.operator} | Node ID: {selectedRecord.validator.id}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      background: 'var(--cyan-glow)',
                      color: 'var(--cyan)',
                      border: '1px solid var(--cyan-dim)',
                    }}
                  >
                    Tier {selectedRecord.report.scoreExplanation.rankingTier}
                  </span>
                </div>
              </div>

              {/* Geographic and specs block */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  background: 'var(--bg-base)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Region</span>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Globe size={12} /> {selectedRecord.validator.region} ({selectedRecord.validator.country})
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Protocol</span>
                  <strong style={{ marginTop: '2px', display: 'block' }}>{selectedRecord.validator.protocolVersion}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Voting Quorum</span>
                  <strong style={{ marginTop: '2px', display: 'block' }}>{selectedRecord.validator.votingPower}%</strong>
                </div>
              </div>

              {/* Score Explanation Detail */}
              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Score Explanation
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Participation Rate</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>
                      {selectedRecord.report.scoreExplanation.participationScore}%
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Latency Metric</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>
                      {selectedRecord.report.scoreExplanation.latencyScore}/100
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Decentralization Rank</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>
                      {selectedRecord.report.scoreExplanation.decentralizationScore}/100
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Consistency Index</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>
                      {selectedRecord.report.scoreExplanation.consistencyScore}/100
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    padding: '8px 12px',
                    background: 'var(--bg-hover)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--cyan)',
                  }}
                >
                  {selectedRecord.report.scoreExplanation.details}
                </div>
              </div>
            </Card>

            {/* AI Weekly Prediction Chart */}
            <Card>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="var(--cyan)" />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>AI Weekly Performance Prediction</h3>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Model Accuracy: {selectedRecord.report.predictionAccuracy}%
                </span>
              </div>

              {/* Chart */}
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={selectedRecord.report.weeklyPrediction}
                    margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="predictionColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                    <XAxis
                      dataKey="dateStr"
                      tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                    />
                    <YAxis
                      domain={[90, 100]}
                      tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                    <Area
                      type="monotone"
                      name="Predicted Uptime/Participation (%)"
                      dataKey="predictedParticipation"
                      stroke="var(--cyan)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#predictionColor)"
                    />
                    <Area
                      type="monotone"
                      name="Confidence Lower Bound (75%)"
                      dataKey="lowerParticipationBound"
                      stroke="var(--red-dim, #ef4444)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '12px',
                  background: 'var(--bg-base)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Info size={14} color="var(--cyan)" />
                <span>
                  The weekly time-series model projects validator participation with high-reliability bounds.
                </span>
              </div>
            </Card>

            {/* Performance Report & Recommendation */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FileText size={18} color="var(--cyan)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Staking & Trust Analysis Report</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: selectedRecord.report.scoreExplanation.weightedScore >= 75
                      ? 'rgba(0, 230, 118, 0.05)'
                      : 'rgba(255, 23, 68, 0.05)',
                    border: selectedRecord.report.scoreExplanation.weightedScore >= 75
                      ? '1px solid rgba(0, 230, 118, 0.2)'
                      : '1px solid rgba(255, 23, 68, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: selectedRecord.report.scoreExplanation.weightedScore >= 75
                        ? 'var(--green)'
                        : 'var(--red)',
                      marginBottom: '6px',
                    }}
                  >
                    {selectedRecord.report.scoreExplanation.weightedScore >= 75 ? (
                      <>
                        <CheckCircle size={16} />
                        Staking Recommendation: Recommended
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} />
                        Staking Recommendation: Risk Flagged
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                    {selectedRecord.report.recommendation}
                  </div>
                </div>

                {/* Anomalies section */}
                <div>
                  <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Anomaly Detection Log
                  </h4>
                  {selectedRecord.report.anomaliesFound.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedRecord.report.anomaliesFound.map((anomaly, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            padding: '8px 10px',
                            background: 'var(--bg-base)',
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: `3px solid ${anomaly.severity === 'high' ? 'var(--red)' : 'var(--amber)'}`,
                            fontSize: '11px',
                          }}
                        >
                          <span style={{ fontWeight: 700, minWidth: '76px', color: 'var(--text-muted)' }}>
                            {anomaly.date}
                          </span>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>{anomaly.type}</strong> -{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>{anomaly.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', italic: 'true' }}>
                      No behavior anomalies detected in the past 30 days. Uptime profile matches historical expectation.
                    </div>
                  )}
                </div>

                {/* Export CTA Button */}
                <button
                  onClick={handleExportReport}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--cyan)',
                    background: 'transparent',
                    color: 'var(--cyan)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 120ms ease',
                    marginTop: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--cyan-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Download size={14} />
                  Export Performance & Prediction Report (.txt)
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
