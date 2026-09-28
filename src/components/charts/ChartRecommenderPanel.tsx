import React, { useState, useEffect } from 'react';
import { ChartRecommendationEngine, DataCharacteristics, UserIntent, ChartRecommendation } from '../../lib/chartRecommendation';
import AdvancedChartLibrary from './AdvancedChartLibrary';
import { Brain, CheckCircle, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';

interface ChartRecommenderPanelProps {
  data: any[];
  title?: string;
  dataKeys?: string[];
  defaultIntentGoal?: 'comparison' | 'trend' | 'distribution' | 'relationship' | 'composition';
}

export default function ChartRecommenderPanel({
  data,
  title = 'AI Chart Recommender',
  dataKeys = ['value'],
  defaultIntentGoal = 'trend',
}: ChartRecommenderPanelProps) {
  const [goal, setGoal] = useState<UserIntent['goal']>(defaultIntentGoal);
  const [audience, setAudience] = useState<UserIntent['audience']>('general');
  const [selectedChartType, setSelectedChartType] = useState<'line' | 'bar' | 'area' | 'sankey' | 'heatmap'>('line');
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([]);
  const [characteristics, setCharacteristics] = useState<DataCharacteristics | null>(null);
  const [effectiveness, setEffectiveness] = useState<{ overallScore: number; feedback: string[] }>({
    overallScore: 1.0,
    feedback: [],
  });

  // Automatically analyze characteristics on data change
  useEffect(() => {
    if (!data || data.length === 0) return;

    // Detect dataType
    let dataType: DataCharacteristics['dataType'] = 'numerical';
    const firstPoint = data[0];
    const keys = Object.keys(firstPoint).filter((k) => k !== 'name' && k !== 'timestamp');

    // Simple heuristic analysis for characteristics
    const hasNegative = data.some((point) => keys.some((k) => typeof point[k] === 'number' && point[k] < 0));
    const volume: DataCharacteristics['volume'] = data.length < 15 ? 'low' : data.length < 50 ? 'medium' : 'high';
    
    // Check if temporal (typically has 'timestamp' or date-like 'name')
    const isTemporal = data.some((point) => point.timestamp || (point.name && !isNaN(Date.parse(point.name))));
    
    if (isTemporal) {
      dataType = 'temporal';
    } else if (keys.length > 2) {
      dataType = 'mixed';
    } else if (data.every((point) => typeof point.name === 'string' && isNaN(Number(point.name)))) {
      dataType = 'categorical';
    }

    const detectedCharacteristics: DataCharacteristics = {
      dataType,
      volume,
      sparsity: 0.1, // default heuristic
      skewness: 0,
      hasNegativeValues: hasNegative,
      uniqueCategoriesCount: data.length,
    };

    setCharacteristics(detectedCharacteristics);

    const intent: UserIntent = { goal, audience };
    const recs = ChartRecommendationEngine.recommendCharts(detectedCharacteristics, intent);
    setRecommendations(recs);

    if (recs.length > 0) {
      // Pick top recommendation automatically
      const topType = recs[0].chartType as any;
      if (['line', 'bar', 'area', 'sankey', 'heatmap'].includes(topType)) {
        setSelectedChartType(topType);
      }
    }
  }, [data, goal, audience]);

  // Re-assess effectiveness when chart type changes manually
  useEffect(() => {
    if (!characteristics) return;
    const intent: UserIntent = { goal, audience };
    const assess = ChartRecommendationEngine.assessEffectiveness(selectedChartType, characteristics, intent);
    setEffectiveness(assess);
  }, [selectedChartType, characteristics, goal, audience]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
      fontFamily: 'var(--font-display)',
    }}>
      {/* AI Suggestions Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={22} style={{ color: 'var(--cyan)' }} />
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {title} <Sparkles size={14} style={{ color: 'var(--cyan)' }} />
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
              Smart visualizations based on data profile & user goal
            </p>
          </div>
        </div>

        {/* Intent Customization Controls */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as any)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="trend">Goal: Show Trends</option>
            <option value="comparison">Goal: Compare Categories</option>
            <option value="relationship">Goal: Analyze Relationships</option>
            <option value="composition">Goal: Flow & Composition</option>
          </select>

          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as any)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="general">Audience: General</option>
            <option value="executive">Audience: Executive</option>
            <option value="technical">Audience: Technical</option>
          </select>
        </div>
      </div>

      {/* Recommendations Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>AI Recommends:</span>
        {recommendations.map((rec) => {
          const isActive = selectedChartType === rec.chartType;
          return (
            <button
              key={rec.chartType}
              onClick={() => setSelectedChartType(rec.chartType as any)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '20px',
                border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                background: isActive ? 'var(--cyan-glow)' : 'var(--bg-base)',
                color: isActive ? 'var(--cyan)' : 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>{rec.chartType}</span>
              <span style={{
                fontSize: '10px',
                opacity: 0.8,
                background: 'rgba(255,255,255,0.1)',
                padding: '1px 4px',
                borderRadius: '4px',
              }}>
                {Math.round(rec.confidenceScore * 100)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Effectiveness Assessment Summary */}
      <div style={{
        padding: '12px',
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        fontSize: '13px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {effectiveness.overallScore >= 0.8 ? (
            <CheckCircle size={16} style={{ color: 'var(--green)' }} />
          ) : (
            <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
          )}
          <span style={{ fontWeight: 600 }}>
            Effectiveness Score: {Math.round(effectiveness.overallScore * 100)}%
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
          {effectiveness.feedback.map((fb, idx) => (
            <li key={idx} style={{ marginBottom: '4px' }}>{fb}</li>
          ))}
        </ul>
      </div>

      {/* Generated Chart Container */}
      <div style={{ minHeight: '350px' }}>
        <AdvancedChartLibrary
          data={data}
          type={selectedChartType}
          title={title}
          dataKeys={dataKeys}
          interactive={true}
          exportable={true}
        />
      </div>
    </div>
  );
}
