import React, { useEffect, useState } from 'react';
import { fetchTransactions } from '../../api/transactions';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import AccessibleChart from '../charts/AccessibleChart';

// Mock data generators (replace with real data)
const generateFrequencyData = (transactions) => {
  // Group by day (simplified)
  const map = {};
  transactions.forEach((tx) => {
    const date = new Date(tx.timestamp).toLocaleDateString();
    map[date] = (map[date] || 0) + 1;
  });
  return Object.entries(map).map(([date, count]) => ({ date, count }));
};

const generateAmountDistribution = (transactions) => {
  // Simple bins
  const bins = [0, 10, 50, 100, 500, 1000, 5000];
  const counts = bins.map(() => 0);
  transactions.forEach((tx) => {
    const amount = Number(tx.amount);
    for (let i = bins.length - 1; i >= 0; i--) {
      if (amount >= bins[i]) {
        counts[i]++;
        break;
      }
    }
  });
  return bins.map((b, i) => ({ range: `${b}+`, count: counts[i] }));
};

export default function TransactionAnalyticsDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [freqData, setFreqData] = useState([]);
  const [distData, setDistData] = useState([]);

  useEffect(() => {
    fetchTransactions()
      .then((data) => {
        setTransactions(data);
        setFreqData(generateFrequencyData(data));
        setDistData(generateAmountDistribution(data));
      })
      .catch((e) => console.error('Failed to load transactions', e));
  }, []);

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '24px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px' }}>Transaction Analytics</h2>
      {/* Frequency Chart */}
      <AccessibleChart
        title="Transaction Frequency"
        data={freqData}
        series={[{ key: 'count', label: 'Tx Count' }]}
        categoryKey="date"
        categoryLabel="Date"
        height={300}
        emptyMessage="No transaction frequency data is currently available."
      >
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={freqData}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type='monotone' dataKey='count' stroke='var(--cyan)' name='Tx Count' />
          </LineChart>
        </ResponsiveContainer>
      </AccessibleChart>
      {/* Amount Distribution */}
      <AccessibleChart
        title="Transaction Amount Distribution"
        data={distData}
        series={[{ key: 'count', label: 'Transactions' }]}
        categoryKey="range"
        categoryLabel="Amount range"
        height={300}
        emptyMessage="No transaction amount distribution data is currently available."
      >
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={distData}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='range' />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey='count' fill='var(--amber)' name='Transactions' />
          </BarChart>
        </ResponsiveContainer>
      </AccessibleChart>
      {/* Additional charts (counterparty, time‑of‑day, seasonal, prediction) can be added similarly */}
    </div>
  );
}
