import React, { useMemo, useState } from 'react';
import {
  BarChart2,
  Calendar,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  Grid,
  Info,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  calculateCohortRetention,
  exportCohortDataAsCsv,
  exportCohortDataAsJson,
  generateMockAccountActivities,
  type AccountActivityRecord,
  type ActivityFilter,
  type CohortGranularity,
  type CohortRetentionResult,
} from '../../lib/cohortRetention';
import AccessibleChart from '../charts/AccessibleChart';

export interface CohortRetentionViewProps {
  /** Optional custom account activity records. If not provided, mock data is used */
  activities?: AccountActivityRecord[];
  /** Optional container title override */
  title?: string;
  /** Optional callback when data is exported */
  onExport?: (format: 'csv' | 'json', payload: string) => void;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card, #131722)',
  border: '1px solid var(--border, #2a2e39)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: '16px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-elevated, #1e222d)',
  border: '1px solid var(--border, #2a2e39)',
  color: 'var(--text-primary, #f0f3fa)',
  borderRadius: 'var(--radius-md, 6px)',
  padding: '6px 10px',
  fontSize: '12px',
  outline: 'none',
  cursor: 'pointer',
};

const buttonStyle: React.CSSProperties = {
  background: 'var(--bg-elevated, #1e222d)',
  border: '1px solid var(--border, #2a2e39)',
  color: 'var(--text-primary, #f0f3fa)',
  borderRadius: 'var(--radius-md, 6px)',
  padding: '6px 12px',
  fontSize: '12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

function downloadFile(filename: string, content: string, mimeType: string) {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
      return;
    }
  } catch (e) {
    // Fallback or ignore in unsupported test/server environments
  }
}

/**
 * Returns background color and text color for heatmap cells based on retention %
 */
function getCellColor(percentage: number): { background: string; color: string; border: string } {
  if (percentage <= 0) {
    return {
      background: 'rgba(255, 255, 255, 0.02)',
      color: 'var(--text-muted, #787b86)',
      border: '1px solid rgba(255, 255, 255, 0.04)',
    };
  }
  if (percentage >= 80) {
    return {
      background:
        'linear-gradient(135deg, rgba(6, 182, 212, 0.45) 0%, rgba(14, 165, 233, 0.45) 100%)',
      color: '#ffffff',
      border: '1px solid rgba(6, 182, 212, 0.6)',
    };
  }
  if (percentage >= 60) {
    return {
      background:
        'linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(5, 150, 105, 0.4) 100%)',
      color: '#ffffff',
      border: '1px solid rgba(16, 185, 129, 0.5)',
    };
  }
  if (percentage >= 40) {
    return {
      background:
        'linear-gradient(135deg, rgba(245, 158, 11, 0.4) 0%, rgba(217, 119, 6, 0.4) 100%)',
      color: '#ffffff',
      border: '1px solid rgba(245, 158, 11, 0.5)',
    };
  }
  if (percentage >= 20) {
    return {
      background:
        'linear-gradient(135deg, rgba(249, 115, 22, 0.35) 0%, rgba(2ea, 88, 12, 0.35) 100%)',
      color: '#f0f3fa',
      border: '1px solid rgba(249, 115, 22, 0.4)',
    };
  }
  return {
    background:
      'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(124, 58, 237, 0.25) 100%)',
    color: '#d1d5db',
    border: '1px solid rgba(139, 92, 246, 0.3)',
  };
}

export default function CohortRetentionView({
  activities: externalActivities,
  title = 'Cohort Retention Views',
  onExport,
}: CohortRetentionViewProps) {
  const [granularity, setGranularity] = useState<CohortGranularity>('week');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [viewMode, setViewMode] = useState<'percent' | 'count'>('percent');
  const [maxPeriods, setMaxPeriods] = useState<number>(8);
  const [useMockFallback, setUseMockFallback] = useState<boolean>(false);
  const [mockSeed, setMockSeed] = useState<number>(1);

  // Generate mock dataset when explicitly toggled or when external dataset is empty
  const mockActivities = useMemo(() => {
    return generateMockAccountActivities(60, 90);
  }, [mockSeed]);

  const activeRecords = useMemo(() => {
    if (useMockFallback) return mockActivities;
    if (externalActivities && externalActivities.length > 0) return externalActivities;
    return mockActivities; // Default to mock activities for demonstration
  }, [externalActivities, mockActivities, useMockFallback]);

  // Calculate cohort retention
  const retentionResult: CohortRetentionResult = useMemo(() => {
    return calculateCohortRetention(activeRecords, {
      granularity,
      activityFilter,
      maxPeriods,
      maxCohorts: 12,
    });
  }, [activeRecords, granularity, activityFilter, maxPeriods]);

  // Handle Export CSV
  const handleExportCsv = () => {
    const csv = exportCohortDataAsCsv(retentionResult);
    if (onExport) onExport('csv', csv);
    downloadFile(`cohort-retention-${granularity}.csv`, csv, 'text/csv');
  };

  // Handle Export JSON
  const handleExportJson = () => {
    const json = exportCohortDataAsJson(retentionResult);
    if (onExport) onExport('json', json);
    downloadFile(`cohort-retention-${granularity}.json`, json, 'application/json');
  };

  const handleRegenerateMock = () => {
    setUseMockFallback(true);
    setMockSeed((prev) => prev + 1);
  };

  if (!retentionResult.ok) {
    return (
      <div style={cardStyle} role="alert" aria-live="polite">
        <div
          style={{
            color: 'var(--red, #ef4444)',
            fontWeight: 600,
            fontSize: '16px',
            marginBottom: '8px',
          }}
        >
          Error Loading Cohort Retention Data
        </div>
        <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '13px', marginBottom: '12px' }}>
          {retentionResult.error.message}
        </p>
        <button style={buttonStyle} onClick={handleRegenerateMock}>
          <RefreshCw size={14} /> Retry with Demo Data
        </button>
      </div>
    );
  }

  const { cohorts, periodsHeader, stats } = retentionResult.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} style={{ color: 'var(--cyan, #06b6d4)' }} />
              <h2
                style={{
                  fontFamily: 'var(--font-display, sans-serif)',
                  fontSize: '20px',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {title}
              </h2>
            </div>
            <p
              style={{
                color: 'var(--text-muted, #787b86)',
                fontSize: '13px',
                margin: '4px 0 0 30px',
              }}
            >
              Group accounts by initial activity period and analyze cohort retention over time.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              style={buttonStyle}
              onClick={handleRegenerateMock}
              title="Generate new demo activity dataset"
              aria-label="Refresh Demo Data"
            >
              <RefreshCw size={14} /> Demo Data
            </button>
            <button
              style={buttonStyle}
              onClick={handleExportCsv}
              title="Export CSV"
              aria-label="Export CSV"
            >
              <FileSpreadsheet size={14} /> CSV
            </button>
            <button
              style={buttonStyle}
              onClick={handleExportJson}
              title="Export JSON"
              aria-label="Export JSON"
            >
              <FileJson size={14} /> JSON
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border, #2a2e39)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Granularity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: 'var(--text-muted, #787b86)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)' }}>Period:</span>
              <select
                style={selectStyle}
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as CohortGranularity)}
                aria-label="Select Cohort Period Granularity"
              >
                <option value="day">Daily (Days)</option>
                <option value="week">Weekly (Weeks)</option>
                <option value="month">Monthly (Months)</option>
              </select>
            </div>

            {/* Activity Type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--text-muted, #787b86)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)' }}>
                Activity:
              </span>
              <select
                style={selectStyle}
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                aria-label="Filter Activity Type"
              >
                <option value="all">All Activities</option>
                <option value="payment">Payments Only</option>
                <option value="contract">Smart Contracts</option>
                <option value="trade">DEX Trades</option>
              </select>
            </div>

            {/* Max Periods */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)' }}>
                Periods:
              </span>
              <select
                style={selectStyle}
                value={maxPeriods}
                onChange={(e) => setMaxPeriods(Number(e.target.value))}
                aria-label="Select Number of Periods"
              >
                <option value={6}>6 Periods</option>
                <option value={8}>8 Periods</option>
                <option value={12}>12 Periods</option>
              </select>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-elevated, #1e222d)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '2px',
              border: '1px solid var(--border, #2a2e39)',
            }}
          >
            <button
              style={{
                ...buttonStyle,
                border: 'none',
                background: viewMode === 'percent' ? 'var(--cyan, #06b6d4)' : 'transparent',
                color: viewMode === 'percent' ? '#ffffff' : 'var(--text-muted, #787b86)',
                fontWeight: viewMode === 'percent' ? 600 : 400,
                padding: '4px 10px',
              }}
              onClick={() => setViewMode('percent')}
              aria-label="Show Retention Percentages"
            >
              Percentage (%)
            </button>
            <button
              style={{
                ...buttonStyle,
                border: 'none',
                background: viewMode === 'count' ? 'var(--cyan, #06b6d4)' : 'transparent',
                color: viewMode === 'count' ? '#ffffff' : 'var(--text-muted, #787b86)',
                fontWeight: viewMode === 'count' ? 600 : 400,
                padding: '4px 10px',
              }}
              onClick={() => setViewMode('count')}
              aria-label="Show Account Counts"
            >
              Account Count (#)
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={cardStyle}>
          <div
            style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)', marginBottom: '4px' }}
          >
            Total Tracked Cohorts
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #f0f3fa)' }}>
            {stats.totalCohorts}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)', marginBottom: '4px' }}
          >
            Unique Tracked Accounts
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--cyan, #06b6d4)' }}>
            {stats.totalUniqueAccounts}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)', marginBottom: '4px' }}
          >
            Avg Period 1 Retention (+1 {granularity})
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--green, #10b981)' }}>
            {stats.avgPeriod1Retention}%
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)', marginBottom: '4px' }}
          >
            Avg Period 4 Retention (+4 {granularity}s)
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--amber, #f59e0b)' }}>
            {stats.avgPeriod4Retention}%
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)', marginBottom: '4px' }}
          >
            Best Performing Cohort
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--purple, #a855f7)',
              marginTop: '4px',
            }}
          >
            {stats.bestCohortKey || 'N/A'}
          </div>
        </div>
      </div>

      {/* Cohort Heatmap Matrix Table */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Grid size={18} style={{ color: 'var(--cyan, #06b6d4)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              Cohort Retention Matrix
            </h3>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #787b86)' }}>
            Displaying: {viewMode === 'percent' ? 'Retention Rate (%)' : 'Active Accounts (#)'}
          </div>
        </div>

        {cohorts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: 'var(--text-muted, #787b86)',
            }}
          >
            <Info size={28} style={{ marginBottom: '8px', opacity: 0.7 }} />
            <p style={{ margin: 0 }}>
              No account activity data matched the selected cohort filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: '4px',
                fontSize: '12px',
                textAlign: 'center',
              }}
              aria-label="Cohort Retention Table"
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-elevated, #1e222d)',
                      borderRadius: 'var(--radius-md, 6px)',
                      color: 'var(--text-muted, #787b86)',
                      textAlign: 'left',
                      minWidth: '130px',
                    }}
                    scope="col"
                  >
                    Cohort
                  </th>
                  <th
                    style={{
                      padding: '8px 10px',
                      background: 'var(--bg-elevated, #1e222d)',
                      borderRadius: 'var(--radius-md, 6px)',
                      color: 'var(--text-muted, #787b86)',
                      minWidth: '80px',
                    }}
                    scope="col"
                  >
                    Accounts
                  </th>
                  {periodsHeader.map((header, idx) => (
                    <th
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg-elevated, #1e222d)',
                        borderRadius: 'var(--radius-md, 6px)',
                        color: 'var(--text-muted, #787b86)',
                        minWidth: '70px',
                      }}
                      scope="col"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((row) => (
                  <tr key={row.cohortKey}>
                    {/* Cohort Label */}
                    <td
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-elevated, #1e222d)',
                        borderRadius: 'var(--radius-md, 6px)',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: 'var(--text-primary, #f0f3fa)',
                      }}
                      scope="row"
                    >
                      <div>{row.cohortKey}</div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--text-muted, #787b86)',
                          fontWeight: 400,
                        }}
                      >
                        {row.cohortLabel}
                      </div>
                    </td>

                    {/* Total Cohort Size */}
                    <td
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg-elevated, #1e222d)',
                        borderRadius: 'var(--radius-md, 6px)',
                        fontWeight: 600,
                        color: 'var(--cyan, #06b6d4)',
                      }}
                    >
                      {row.totalAccounts}
                    </td>

                    {/* Period Cells */}
                    {periodsHeader.map((_, pIdx) => {
                      const pct = row.retentionByPeriod[pIdx] ?? 0;
                      const activeCount = row.activeAccountsByPeriod[pIdx] ?? 0;
                      const cellStyle = getCellColor(pct);

                      return (
                        <td
                          key={pIdx}
                          style={{
                            padding: '8px 6px',
                            borderRadius: 'var(--radius-md, 6px)',
                            fontWeight: 600,
                            background: cellStyle.background,
                            color: cellStyle.color,
                            border: cellStyle.border,
                            transition: 'transform 0.1s ease',
                          }}
                          title={`${activeCount} / ${row.totalAccounts} accounts active (${pct}%)`}
                        >
                          {viewMode === 'percent' ? `${pct}%` : activeCount}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Average Retention Curve Line Chart */}
      <AccessibleChart
        title="Average Cohort Retention Curve"
        data={stats.retentionCurve}
        series={[{ key: 'avgRetentionRate', label: 'Average Retention Rate (%)' }]}
        categoryKey="periodLabel"
        categoryLabel="Period"
        height={280}
        emptyMessage="No retention curve data is currently available."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.retentionCurve}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #2a2e39)" />
            <XAxis
              dataKey="periodLabel"
              stroke="var(--text-muted, #787b86)"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              stroke="var(--text-muted, #787b86)"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated, #1e222d)',
                borderColor: 'var(--border, #2a2e39)',
                borderRadius: '8px',
                color: 'var(--text-primary, #f0f3fa)',
                fontSize: '12px',
              }}
              formatter={(value: any) => [`${value}%`, 'Avg Retention']}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line
              type="monotone"
              dataKey="avgRetentionRate"
              name="Avg Retention Rate (%)"
              stroke="var(--cyan, #06b6d4)"
              strokeWidth={3}
              dot={{ r: 5, fill: 'var(--cyan, #06b6d4)' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </div>
  );
}
