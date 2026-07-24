export {
  analyzeError,
  runBatchAnalysis,
  getErrorTrends,
} from './ErrorPatternAnalyzer';
export type { AnalysisResult, TemporalPattern, ErrorTrend } from './ErrorPatternAnalyzer';

export {
  getRecommendations,
  recordSolutionFeedback,
} from './SolutionRecommender';
export type { RecommendedSolution } from './SolutionRecommender';

export {
  getContextualHelp,
  getTabSpecificHelp,
  getSearchHelp,
} from './ContextualHelpProvider';
export type { HelpSuggestion } from './ContextualHelpProvider';

export {
  recordFix,
  updateFixHelpful,
  getRecentFixes,
  getFixesByFingerprint,
  getSimilarFixes,
  getPatternsByCategory,
  clearAllData,
  generateFingerprint,
} from './FixHistoryStore';
export type { FixRecord } from './FixHistoryStore';

export interface AssistantContext {
  error: unknown;
  errorMessage: string;
  category: string;
  context: string;
  network: string;
  activeTab: string;
}

export interface AssistantResponse {
  analysis: import('./ErrorPatternAnalyzer').AnalysisResult;
  solutions: import('./SolutionRecommender').RecommendedSolution[];
  help: import('./ContextualHelpProvider').HelpSuggestion[];
}

export async function analyzeWithAssistant(ctx: AssistantContext): Promise<AssistantResponse> {
  const [analysis, solutions, help] = await Promise.all([
    import('./ErrorPatternAnalyzer').then((m) =>
      m.analyzeError(ctx.error, ctx.context, ctx.network, ctx.activeTab),
    ),
    import('./SolutionRecommender').then((m) =>
      m.getRecommendations(ctx.error, ctx.category, ctx.context),
    ),
    Promise.resolve(
      getContextualHelp(ctx.activeTab, ctx.network, ctx.category),
    ),
  ]);

  return { analysis, solutions, help };
}
