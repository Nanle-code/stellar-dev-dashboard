import React from 'react';
import Card, { StatCard } from '../src/components/dashboard/Card';

export default {
  title: 'Dashboard/Cards',
  component: Card,
};

export const Standard = () => (
  <Card title="Standard Card" subtitle="Optional subtitle description">
    <div style={{ padding: '18px' }}>
      Card content goes here.
    </div>
  </Card>
);

export const WithAction = () => (
  <Card 
    title="Card with Action" 
    action={<button style={{ background: 'var(--cyan-glow)', border: '1px solid var(--cyan-dim)', color: 'var(--cyan)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Action</button>}
  >
    <div style={{ padding: '18px' }}>
      Content with a top-right action button.
    </div>
  </Card>
);

export const Glowing = () => (
  <Card title="Glowing Card" glow={true}>
    <div style={{ padding: '18px' }}>
      This card has a subtle cyan glow effect.
    </div>
  </Card>
);

export const Stats = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
    <StatCard label="Total XLM" value="1,234.56" sub="Available balance" />
    <StatCard label="Operations" value="42" sub="Last 24 hours" accent="var(--amber)" />
    <StatCard label="Risk Score" value="Low" sub="Account analysis" accent="var(--green)" />
    <StatCard label="Loading State" loading={true} />
  </div>
);
