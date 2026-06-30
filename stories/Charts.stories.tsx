import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts';

const meta: Meta = {
  title: 'Charts',
  parameters: {
    docs: { description: { component: 'Recharts-based analytics charts with mock data.' } },
  },
};
export default meta;

const CYAN = '#00e5ff', GREEN = '#22c55e', RED = '#ef4444', AMBER = '#f59e0b';
const PIE_COLORS = [CYAN, AMBER, GREEN, RED, '#8884d8', '#82ca9d'];
const TOOLTIP_STYLE = {
  contentStyle: { background: '#1a2230', border: '1px solid #2a3545', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#a0aec0' },
};
const TICK = { fill: '#718096', fontSize: 11 };

const networkData = Array.from({ length: 20 }, (_, i) => ({
  label: `${String(12 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
  txCount: Math.floor(Math.random() * 60) + 10,
  failedTx: Math.floor(Math.random() * 8),
  opCount: Math.floor(Math.random() * 150) + 20,
}));

const balanceData = [
  { asset: 'XLM', balance: 12345 },
  { asset: 'USDC', balance: 500 },
  { asset: 'yXLM', balance: 234 },
  { asset: 'SHX', balance: 1000 },
];

const txByDay = [
  { day: 'May 28', successful: 8, failed: 0 },
  { day: 'May 29', successful: 3, failed: 2 },
  { day: 'May 30', successful: 12, failed: 1 },
  { day: 'May 31', successful: 7, failed: 0 },
  { day: 'Jun 1', successful: 15, failed: 2 },
];

const opsByType = [
  { name: 'Payment', count: 24 },
  { name: 'Create Account', count: 4 },
  { name: 'Change Trust', count: 8 },
  { name: 'Manage Offer', count: 6 },
  { name: 'Path Payment', count: 3 },
];

// ─── NetworkMetricsChart ──────────────────────────────────────────────────────

export const NetworkMetricsDefault: StoryObj = {
  name: 'NetworkMetricsChart — Default',
  render: () => (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Network Metrics</div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>TRANSACTIONS</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={networkData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={TICK} interval={4} />
            <YAxis tick={TICK} width={30} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="txCount" name="Successful" stroke={GREEN} fill={`${GREEN}22`} strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="failedTx" name="Failed" stroke={RED} fill={`${RED}22`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>OPERATIONS</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={networkData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={TICK} interval={4} />
            <YAxis tick={TICK} width={30} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="opCount" name="Operations" stroke={CYAN} fill={`${CYAN}22`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  ),
};

export const NetworkMetricsMobile: StoryObj = {
  name: 'NetworkMetricsChart — Mobile',
  render: () => <NetworkMetricsDefault.render />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

// ─── BalanceHistoryChart ──────────────────────────────────────────────────────

export const BalanceHistoryDefault: StoryObj = {
  name: 'BalanceHistoryChart — Default',
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Balance History</div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={balanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="asset" tick={TICK} />
            <YAxis tick={TICK} width={50} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="balance" name="Balance" radius={[4, 4, 0, 0]}>
              {balanceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  ),
};

export const BalanceHistoryMobile: StoryObj = {
  name: 'BalanceHistoryChart — Mobile',
  render: () => <BalanceHistoryDefault.render />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

// ─── AccountActivityChart ─────────────────────────────────────────────────────

export const AccountActivityDefault: StoryObj = {
  name: 'AccountActivityChart — Default',
  render: () => (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Account Activity</div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>TRANSACTIONS BY DAY</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={txByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={TICK} />
            <YAxis tick={TICK} width={25} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="successful" name="Successful" fill={GREEN} stackId="a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="failed" name="Failed" fill={RED} stackId="a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>OPERATIONS BY TYPE</div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <PieChart width={180} height={180}>
            <Pie data={opsByType} dataKey="count" cx="50%" cy="50%" outerRadius={75}>
              {opsByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} />
          </PieChart>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {opsByType.map((op, i) => (
              <div key={op.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>{op.name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{op.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
};

export const AccountActivityEmpty: StoryObj = {
  name: 'AccountActivityChart — Empty',
  render: () => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 48, textAlign: 'center', maxWidth: 480 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No activity data</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connect an account to view analytics.</div>
    </div>
  ),
};

export const AccountActivityMobile: StoryObj = {
  name: 'AccountActivityChart — Mobile',
  render: () => <AccountActivityDefault.render />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};
