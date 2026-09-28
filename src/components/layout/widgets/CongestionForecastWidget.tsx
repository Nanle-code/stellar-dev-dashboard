import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../../../lib/store';
import { fetchNetworkStats } from '../../../lib/stellar';
import { useErrorHandler } from '../../../hooks/useErrorHandler';
import WidgetBase from './WidgetBase';
import { format } from 'date-fns';
import { trainModel, forecast, recommendTiming, DataPoint } from '../../../congestion/predictor';

function buildSyntheticHistory(baseTx: number, baseActiveUsers: number, now: number): DataPoint[] {
  const history: DataPoint[] = [];
  for (let i = 72; i > 0; i--) {
    const ts = now - i * 3600_000;
    const h = new Date(ts).getUTCHours();
    const d = new Date(ts).getUTCDay();
    const diurnal = 40 + 30 * Math.sin((2 * Math.PI * h) / 24);
    const weekly = 18 + 12 * Math.cos((2 * Math.PI * d) / 7);
    const eventFlag = h === 12 && (i % 48 === 0) ? 1 : 0;
    const activeUsers = Math.max(20, Math.round(baseActiveUsers * (0.85 + 0.3 * Math.sin((2 * Math.PI * (h + d)) / 24))));
    const txCount = Math.max(0, Math.round(diurnal + weekly + activeUsers * 0.15 + eventFlag * 80 + (Math.random() - 0.5) * 15));
    history.push({ ts, txCount, activeUsers, eventFlag });
  }
  return history;
}

const upcomingNetworkEvents = [
  { label: 'Scheduled upgrade', offsetHours: 2 },
  { label: 'Major payment deadline', offsetHours: 5 }
];

function formatHourLabel(ts: number) {
  return format(new Date(ts), 'ha');
}

export default function CongestionForecastWidget({ onRefresh }: { onRefresh?: () => void }) {
  const { network } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastRows, setForecastRows] = useState<Array<{ label: string; predicted: number; probability: number; confidence: number }>>([]);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const { handleError } = useErrorHandler('CongestionForecastWidget');

  useEffect(() => {
    let active = true;
    const loadForecast = async () => {
      setLoading(true);
      setError(null);
      try {
        const stats = await fetchNetworkStats(network);
        if (!active) return;
        const latestLedger = stats.latestLedger;
        const recentTxCount = latestLedger.successful_transaction_count + latestLedger.failed_transaction_count;
        const recentActiveUsers = Math.max(40, Math.round(recentTxCount * 0.2 + 20));
        const now = Date.now();
        const history = buildSyntheticHistory(recentTxCount, recentActiveUsers, now);
        const model = trainModel(history, 0.9);
        const events = upcomingNetworkEvents.map((event, index) => (event.offsetHours <= 6 ? 1 : 0));
        const forecasts = forecast(model, { ts: now, txCount: recentTxCount, activeUsers: recentActiveUsers, eventFlag: 0 }, 6, events);
        if (!active) return;
        setForecastRows(forecasts.map((row) => ({
          label: formatHourLabel(row.ts),
          predicted: Math.max(0, Math.round(row.predicted)),
          probability: Number((row.probability * 100).toFixed(0)),
          confidence: Number((row.confidence * 100).toFixed(0))
        })));
        const earliest = recommendTiming(forecasts, 0.3);
        setRecommendation(earliest ? `Plan around ${format(new Date(earliest.ts), 'ha')}, when congestion probability is ${Math.round(earliest.probability * 100)}%` : 'No low-congestion window found in the next 6 hours.');
      } catch (loadError) {
        if (!active) return;
        setError('Failed to compute congestion forecast.');
        handleError(loadError);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadForecast();
    return () => {
      active = false;
    };
  }, [network, handleError]);

  const chartData = useMemo(() => forecastRows.map((row) => ({
    name: row.label,
    tx: row.predicted,
    congestion: row.probability
  })), [forecastRows]);

  return (
    <WidgetBase
      title="Network Congestion Forecast"
      subtitle="Predicted next 6 hours" 
      icon="🚦"
      loading={loading}
      error={error ? { message: error } : null}
      onRefresh={onRefresh}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '280px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Recommended timing</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{recommendation}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Peak probability</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--red)' }}>{forecastRows.length ? `${Math.max(...forecastRows.map(r => r.probability))}%` : '—'}</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Confidence</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)' }}>{forecastRows.length ? `${Math.round(forecastRows.reduce((sum, r) => sum + r.confidence, 0) / forecastRows.length)}%` : '—'}</div>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: '240px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" />
              <YAxis
                yAxisId="left"
                stroke="var(--text-secondary)"
                domain={['dataMin - 10', 'dataMax + 20']}
                tickFormatter={(value) => `${value}`}
              />
              <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px' }}
                formatter={(value: number, name: string) => name === 'Congestion' ? [`${value}%`, 'Congestion'] : [`${value}`, 'Predicted tx']}
              />
              <Legend verticalAlign="top" height={24} />
              <Line yAxisId="left" type="monotone" dataKey="tx" stroke="var(--cyan)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="congestion" stroke="var(--red)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </WidgetBase>
  );
}
