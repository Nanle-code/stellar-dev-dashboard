import { ChartRecommendationEngine, DataCharacteristics, UserIntent } from '../chartRecommendation';

describe('ChartRecommendationEngine', () => {
  it('should recommend line chart for temporal trend data', () => {
    const characteristics: DataCharacteristics = {
      dataType: 'temporal',
      volume: 'medium',
      sparsity: 0,
      skewness: 0,
      hasNegativeValues: false,
    };
    const intent: UserIntent = {
      goal: 'trend',
      audience: 'general',
    };

    const recommendations = ChartRecommendationEngine.recommendCharts(characteristics, intent);
    expect(recommendations[0].chartType).toBe('line');
    expect(recommendations[0].confidenceScore).toBeGreaterThanOrEqual(0.9);
  });

  it('should penalize area chart with negative values', () => {
    const characteristics: DataCharacteristics = {
      dataType: 'temporal',
      volume: 'medium',
      sparsity: 0,
      skewness: 0,
      hasNegativeValues: true,
    };
    const intent: UserIntent = {
      goal: 'trend',
      audience: 'general',
    };

    const assessment = ChartRecommendationEngine.assessEffectiveness('area', characteristics, intent);
    expect(assessment.overallScore).toBeLessThan(1.0);
    expect(assessment.feedback[0]).toContain('negative values');
  });
});
