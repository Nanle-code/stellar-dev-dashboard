export interface MLOptimizationSuggestion {
  patternKey: string;
  suggestion: string;
  confidenceScore: number;
  estimatedImpactPct: number;
}

export class MLPerformanceSuggester {
  private highPerfPatterns = [
    {
      key: 'map_lookup',
      pattern: /map\.get\((.*?)\)\.unwrap\(\)/,
      suggestion: 'Use map.get_unchecked() or safe destructuring to avoid redundant bounds checks.',
      confidence: 0.88,
      impactPct: 12,
    },
    {
      key: 'redundant_clone',
      pattern: /\.clone\(\)/,
      suggestion: 'Pass references (&) instead of cloning heavy data structures.',
      confidence: 0.94,
      impactPct: 18,
    },
  ];

  public suggestOptimizations(contractCode: string): MLOptimizationSuggestion[] {
    const suggestions: MLOptimizationSuggestion[] = [];

    for (const item of this.highPerfPatterns) {
      if (item.pattern.test(contractCode)) {
        suggestions.push({
          patternKey: item.key,
          suggestion: item.suggestion,
          confidenceScore: item.confidence,
          estimatedImpactPct: item.impactPct,
        });
      }
    }

    return suggestions;
  }
}