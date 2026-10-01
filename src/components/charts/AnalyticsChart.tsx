import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import AccessibleChart from './AccessibleChart';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getAnimationProps } from '../../utils/reducedMotion';

function ChartShell({ title, children }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          marginBottom: '10px',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export function ActivityTrendChart({ data = [] }) {
  const animation = getAnimationProps(useReducedMotion());
  return (
    <ChartShell title="14-Day Activity">
      <AccessibleChart
        title="14-Day Activity"
        data={data}
        series={[{ key: 'transactions', label: 'Transactions' }]}
        categoryKey="date"
        categoryLabel="Date"
        height={250}
        emptyMessage="No activity data is currently available."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip />
            <Line
              dataKey="transactions"
              stroke="var(--cyan)"
              strokeWidth={2}
              dot={false}
              {...animation}
            />
          </LineChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </ChartShell>
  );
}

export function LatencyTrendChart({ data = [] }) {
  const animation = getAnimationProps(useReducedMotion());
  return (
    <ChartShell title="Latency (Last 24h)">
      <AccessibleChart
        title="Latency (Last 24h)"
        data={data}
        series={[{ key: 'latency', label: 'Latency', unit: 'ms' }]}
        categoryKey="timestamp"
        categoryLabel="Time"
        height={250}
        emptyMessage="No latency data is currently available."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(value) =>
                new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              domain={[0, 'dataMax + 100']}
              unit="ms"
            />
            <Tooltip formatter={(value) => [`${value} ms`, 'Latency']} />
            <Line
              dataKey="latency"
              stroke="var(--cyan)"
              strokeWidth={2}
              dot={false}
              {...animation}
            />
          </LineChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </ChartShell>
  );
}

export function FeeTrendChart({ data = [] }) {
  const animation = getAnimationProps(useReducedMotion());
  return (
    <ChartShell title="Fees (Stroops)">
      <AccessibleChart
        title="Fees (Stroops)"
        data={data}
        series={[{ key: 'fees', label: 'Fees', unit: 'stroops' }]}
        categoryKey="date"
        categoryLabel="Date"
        height={250}
        emptyMessage="No fee data is currently available."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip />
            <Bar dataKey="fees" fill="var(--amber)" {...animation} />
          </BarChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </ChartShell>
  );
}

import LandscapeAnalyticsLayout from './LandscapeAnalyticsLayout';

export default function AnalyticsChart({
  data = [],
  latencyData = [],
}: {
  data?: any[];
  latencyData?: any[];
}) {
  const chartComponents = [
    <ActivityTrendChart key="activity" data={data} />,
    ...(latencyData.length > 0 ? [<LatencyTrendChart key="latency" data={latencyData} />] : []),
    <FeeTrendChart key="fees" data={data} />,
  ];

  return (
    <LandscapeAnalyticsLayout
      title="Analytics Trends"
      subtitle="Activity and Fee performance"
      data={data}
      fallbackMessage="Unable to load analytics chart data"
      charts={chartComponents}
    />
  );
}
