export interface DataCharacteristics {
  dataType: 'numerical' | 'categorical' | 'temporal' | 'mixed';
  volume: 'low' | 'medium' | 'high';
  sparsity: number; // 0 to 1
  skewness: number; // -1 to 1 (roughly)
  hasNegativeValues: boolean;
  uniqueCategoriesCount?: number;
}

export interface UserIntent {
  goal: 'comparison' | 'trend' | 'distribution' | 'relationship' | 'composition';
  audience: 'technical' | 'executive' | 'general';
  focusMetric?: string;
}

export interface ChartRecommendation {
  chartType: 'line' | 'bar' | 'area' | 'sankey' | 'heatmap' | 'scatter';
  confidenceScore: number; // 0 to 1
  effectivenessScore: number; // 0 to 1
  reasons: string[];
}

/**
 * AI-powered Chart Recommendation Engine
 */
export class ChartRecommendationEngine {
  /**
   * Evaluates and recommends appropriate chart types.
   */
  public static recommendCharts(
    characteristics: DataCharacteristics,
    intent: UserIntent
  ): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];

    // Helper logic/rules simulating an analysis & ML-based recommendation
    // Rule 1: Trends over time
    if (characteristics.dataType === 'temporal' || intent.goal === 'trend') {
      const reasons = ['Temporal data is best shown with continuous lines.'];
      let confidence = 0.9;
      if (characteristics.hasNegativeValues) {
        reasons.push('Line charts handle negative ranges well.');
      } else {
        confidence = 0.95;
      }

      recommendations.push({
        chartType: 'line',
        confidenceScore: confidence,
        effectivenessScore: 0.95,
        reasons,
      });

      recommendations.push({
        chartType: 'area',
        confidenceScore: confidence - 0.15,
        effectivenessScore: 0.8,
        reasons: ['Area charts show cumulative totals and trends nicely.', 'Avoid if multiple overlapping series exist.'],
      });
    }

    // Rule 2: Comparisons and distributions
    if (intent.goal === 'comparison' || characteristics.dataType === 'categorical') {
      const isLowVolume = characteristics.volume === 'low';
      recommendations.push({
        chartType: 'bar',
        confidenceScore: isLowVolume ? 0.9 : 0.75,
        effectivenessScore: 0.9,
        reasons: [
          'Bar charts are highly effective for comparing categorical values.',
          isLowVolume ? 'Low data volume is optimal for discrete bars.' : 'Consider grouping or pagination for high volume.'
        ],
      });
    }

    // Rule 3: Complex structures (composition, flows, relationships)
    if (intent.goal === 'relationship') {
      recommendations.push({
        chartType: 'heatmap',
        confidenceScore: characteristics.dataType === 'mixed' ? 0.85 : 0.7,
        effectivenessScore: 0.85,
        reasons: ['Heatmaps excel at showing relationships across two discrete dimensions.'],
      });
    }

    if (intent.goal === 'composition' && characteristics.dataType === 'mixed') {
      recommendations.push({
        chartType: 'sankey',
        confidenceScore: 0.8,
        effectivenessScore: 0.85,
        reasons: ['Sankey diagrams represent flows and compositions between categories effectively.'],
      });
    }

    // Fallback/Default
    if (recommendations.length === 0) {
      recommendations.push({
        chartType: 'bar',
        confidenceScore: 0.6,
        effectivenessScore: 0.6,
        reasons: ['Generic bar chart default for comparison.'],
      });
    }

    // Sort by confidenceScore desc
    return recommendations.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Assesses the effectiveness of a visualization setup.
   */
  public static assessEffectiveness(
    chartType: string,
    characteristics: DataCharacteristics,
    intent: UserIntent
  ): { overallScore: number; feedback: string[] } {
    const feedback: string[] = [];
    let score = 1.0;

    // Check compatibility
    if (chartType === 'area' && characteristics.hasNegativeValues) {
      score -= 0.3;
      feedback.push('Warning: Area charts can be misleading or look incorrect with negative values.');
    }

    if (chartType === 'sankey' && characteristics.dataType !== 'mixed') {
      score -= 0.4;
      feedback.push('Caution: Sankey diagrams typically require flow or mixed source-target categorical relationships.');
    }

    if (chartType === 'line' && characteristics.dataType === 'categorical' && intent.goal !== 'trend') {
      score -= 0.25;
      feedback.push('Notice: Line charts can imply a non-existent chronological order or continuous connection between categories.');
    }

    if (chartType === 'heatmap' && characteristics.sparsity > 0.8) {
      score -= 0.2;
      feedback.push('Notice: High sparsity might make the heatmap look extremely empty.');
    }

    return {
      overallScore: Math.max(0.1, score),
      feedback: feedback.length > 0 ? feedback : ['Perfect chart matching with the data parameters.'],
    };
  }
}
