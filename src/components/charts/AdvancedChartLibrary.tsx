import React, { useState, useRef, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Download, ZoomIn, ZoomOut, Maximize2, Settings, Share2 } from 'lucide-react';

interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface AdvancedChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'bar' | 'area' | 'sankey' | 'heatmap';
  title?: string;
  dataKeys?: string[];
  height?: number;
  interactive?: boolean;
  exportable?: boolean;
}

// Sankey diagram component (simplified)
const SankeyChart = ({ data }: { data: ChartDataPoint[] }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <div style={{ position: 'relative', height: '400px', width: '100%' }}>
      <svg viewBox="0 0 800 400" style={{ width: '100%', height: '100%' }}>
        {/* Simplified sankey visualization */}
        {data.map((item, idx) => (
          <g key={idx}>
            <rect
              x={50 + idx * 150}
              y={100}
              width={60}
              height={200}
              fill={hoveredNode === item.name ? 'var(--cyan)' : 'var(--cyan-dim)'}
              stroke="var(--border)"
              onMouseEnter={() => setHoveredNode(item.name)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer', transition: 'var(--transition)' }}
            />
            <text
              x={80 + idx * 150}
              y={320}
              textAnchor="middle"
              fill="var(--text-primary)"
              fontSize="12"
            >
              {item.name}
            </text>
          </g>
        ))}
        {/* Flow paths */}
        {data.map((_, idx) => {
          if (idx < data.length - 1) {
            return (
              <path
                key={`path-${idx}`}
                d={`M ${110 + idx * 150} 200 Q ${200 + idx * 150} 150 ${200 + idx * 150} 200`}
                stroke="var(--cyan)"
                strokeWidth="2}"
                fill="none"
                opacity="0.5"
              />
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
};

// Heatmap component
const HeatmapChart = ({ data }: { data: ChartDataPoint[] }) => {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const getValue = (item: ChartDataPoint, key: string) => {
    const val = item[key];
    return typeof val === 'number' ? val : 0;
  };

  const getColor = (value: number, max: number) => {
    const intensity = value / max;
    const r = Math.floor(255 * (1 - intensity));
    const g = Math.floor(255 * intensity);
    const b = 150;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'name') : [];
  const maxValue = Math.max(
    ...data.flatMap(item => keys.map(key => getValue(item, key)))
  );

  return (
    <div style={{ display: 'grid', gap: '2px' }}>
      {data.map((item, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', gap: '2px' }}>
          <div style={{
            width: '100px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            {item.name}
          </div>
          {keys.map((key, colIdx) => {
            const value = getValue(item, key);
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                onMouseLeave={() => setHoveredCell(null)}
                style={{
                  width: '60px',
                  height: '40px',
                  background: getColor(value, maxValue),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  border: hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx
                    ? '2px solid var(--text-primary)'
                    : '1px solid var(--border)'
                }}
              >
                {value}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default function AdvancedChartLibrary({
  data,
  type = 'line',
  title,
  dataKeys = ['value'],
  height = 400,
  interactive = true,
  exportable = true
}: AdvancedChartProps) {
  const [zoom, setZoom] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = useCallback(() => {
    if (!chartRef.current) return;
    
    // Create canvas from the chart
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = chartRef.current.offsetWidth * 2;
    canvas.height = chartRef.current.offsetHeight * 2;
    ctx.scale(2, 2);

    // Fill background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim() || '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // This is a simplified export - in production, you'd use html2canvas or similar
    const link = document.createElement('a');
    link.download = `${title || 'chart'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [title]);

  const handleExportSVG = useCallback(() => {
    // Simplified SVG export
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}">
      <rect width="100%" height="100%" fill="var(--bg-base)"/>
      <text x="400" y="${height/2}" text-anchor="middle" fill="var(--text-primary)">Chart Export</text>
    </svg>`;
    
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `${title || 'chart'}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }, [title, height]);

  const handleShare = useCallback(() => {
    const config = { type, dataKeys, title };
    const shareUrl = `${window.location.origin}?chart=${encodeURIComponent(JSON.stringify(config))}`;
    navigator.clipboard.writeText(shareUrl);
  }, [type, dataKeys, title]);

  const renderChart = () => {
    const colors = ['var(--cyan)', 'var(--purple)', 'var(--green)', 'var(--orange)', 'var(--pink)'];

    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {dataKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {dataKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={colors[idx % colors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {dataKeys.map((key, idx) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[idx % colors.length]}
                  fill={colors[idx % colors.length]}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'sankey':
        return <SankeyChart data={data} />;

      case 'heatmap':
        return <HeatmapChart data={data} />;

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
      fontFamily: 'var(--font-mono)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        {title && (
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            {title}
          </h3>
        )}
        
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {interactive && (
            <>
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                style={{
                  padding: '8px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)'
                }}
              >
                <ZoomOut size={16} />
              </button>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                style={{
                  padding: '8px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)'
                }}
              >
                <ZoomIn size={16} />
              </button>
            </>
          )}
          
          {exportable && (
            <>
              <button
                onClick={handleExportPNG}
                style={{
                  padding: '8px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)'
                }}
                title="Export as PNG"
              >
                <Download size={16} />
              </button>
              <button
                onClick={handleExportSVG}
                style={{
                  padding: '8px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)'
                }}
                title="Export as SVG"
              >
                <Download size={16} />
              </button>
              <button
                onClick={handleShare}
                style={{
                  padding: '8px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)'
                }}
                title="Share chart configuration"
              >
                <Share2 size={16} />
              </button>
            </>
          )}
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '8px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-primary)'
            }}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={chartRef}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          transition: 'transform 0.2s ease'
        }}
      >
        {renderChart()}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: '8px'
        }}>
          <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Chart Settings</h4>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Chart Type
              </label>
              <select
                value={type}
                disabled
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="area">Area Chart</option>
                <option value="sankey">Sankey Diagram</option>
                <option value="heatmap">Heatmap</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Zoom Level: {zoom.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
