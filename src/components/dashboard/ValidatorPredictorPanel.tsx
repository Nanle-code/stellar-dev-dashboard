import { useMemo, useState } from 'react'
import { generatePerformanceReport, getValidatorsWithHistory } from '../../lib/validatorPredictor'
import type { CustomScoringCriteria } from '../../lib/validatorPredictor'
import Card, { StatCard } from './Card'

const SCORING_CRITERIA: CustomScoringCriteria = {
  participationWeight: 0.4,
  latencyWeight: 0.2,
  decentralizationWeight: 0.2,
  consistencyWeight: 0.2,
}

export default function ValidatorPredictorPanel() {
  const validators = useMemo(() => getValidatorsWithHistory(), [])
  const reports = useMemo(
    () => validators
      .map((validator) => ({ validator, report: generatePerformanceReport(validator, SCORING_CRITERIA) }))
      .sort((left, right) => right.report.scoreExplanation.weightedScore - left.report.scoreExplanation.weightedScore),
    [validators]
  )
  const [selectedId, setSelectedId] = useState('')
  const selected = reports.find(({ validator }) => validator.id === selectedId) ?? reports[0]

  if (!selected) {
    return <Card title="Validator Performance"><p role="status">No validator history is available.</p></Card>
  }

  const { validator, report } = selected
  const tierColor = report.scoreExplanation.rankingTier === 'S' || report.scoreExplanation.rankingTier === 'A'
    ? 'var(--green)'
    : report.scoreExplanation.rankingTier === 'B' ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <Card title="Validator Performance" subtitle="Local historical scoring and seven-day performance estimate">
        <div style={{ padding: '16px 18px', display: 'grid', gap: '16px' }}>
          <label htmlFor="validator-select" style={{ display: 'grid', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            Validator
            <select
              id="validator-select"
              value={validator.id}
              onChange={(event) => setSelectedId(event.target.value)}
              style={{ maxWidth: '420px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '9px 10px' }}
            >
              {reports.map(({ validator: item, report: itemReport }) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {itemReport.scoreExplanation.weightedScore}/100 · Tier {itemReport.scoreExplanation.rankingTier}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '10px' }}>
            <StatCard label="30-day score" value={`${report.scoreExplanation.weightedScore}/100`} sub={`Tier ${report.scoreExplanation.rankingTier}`} accent={tierColor} />
            <StatCard label="Current uptime" value={`${report.currentUptime}%`} sub="Based on historical participation" accent="var(--green)" />
            <StatCard label="Average latency" value={`${report.averageLatency} ms`} sub={`${validator.country} · ${validator.region}`} accent="var(--cyan)" />
            <StatCard label="Prediction accuracy" value={`${report.predictionAccuracy}%`} sub={`${report.anomaliesFound.length} historical anomalies`} accent="var(--amber)" />
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
            {report.recommendation}
          </p>
        </div>
      </Card>

      <Card title="Seven-day estimate" subtitle={`${validator.operator} · ${validator.protocolVersion}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Participation</th>
                <th style={{ padding: '10px 14px' }}>Latency</th>
                <th style={{ padding: '10px 14px' }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {report.weeklyPrediction.map((point) => (
                <tr key={point.dayOffset} style={{ borderTop: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '12px' }}>
                  <td style={{ padding: '10px 14px' }}>{point.dateStr}</td>
                  <td style={{ padding: '10px 14px' }}>{point.predictedParticipation}%</td>
                  <td style={{ padding: '10px 14px' }}>{point.predictedPing} ms</td>
                  <td style={{ padding: '10px 14px', color: point.riskProbability >= 50 ? 'var(--red)' : 'var(--green)' }}>{point.riskProbability}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Historical anomalies" subtitle="Events detected in the 30-day sample">
        <div style={{ padding: '14px 18px' }}>
          {report.anomaliesFound.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>No anomalies detected.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '10px' }}>
              {report.anomaliesFound.map((anomaly) => (
                <li key={`${anomaly.date}-${anomaly.type}`} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: '10px', alignItems: 'start', fontSize: '12px' }}>
                  <time style={{ color: 'var(--text-muted)' }}>{anomaly.date}</time>
                  <span style={{ color: 'var(--text-primary)' }}>{anomaly.description}</span>
                  <span style={{ color: anomaly.severity === 'high' ? 'var(--red)' : 'var(--amber)', textTransform: 'uppercase', fontSize: '10px' }}>{anomaly.severity}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}