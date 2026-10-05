import { describe, it, expect, beforeAll } from 'vitest';
import { render, waitFor, screen, act } from '@testing-library/react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    return { width: 800, height: 300, top: 0, left: 0, bottom: 300, right: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

describe('scratch', () => {
  it('pie after animation', async () => {
    const { container } = render(
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={[{ name: 'XLM', value: 60 }, { name: 'USDC', value: 40 }]}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value }: any) => `${name} ${value}%`}
          >
            <Cell fill="#00d4ff" />
            <Cell fill="#00ff88" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });
    console.log('PIE HTML:', container.innerHTML.slice(0, 4000));
  });

  it('bar chart axes + legend', async () => {
    const { container } = render(
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={[{ asset: 'XLM', change: 2 }, { asset: 'USDC', change: -1 }]}>
          <XAxis type="number" />
          <YAxis type="category" dataKey="asset" />
          <Legend />
          <Bar dataKey="change" isAnimationActive={false}>
            <Cell fill="green" />
            <Cell fill="red" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });
    console.log('BAR HTML:', container.innerHTML.slice(0, 4000));
  });
});
