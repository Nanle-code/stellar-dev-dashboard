import { categorizeError, formatErrorMessage } from '../../utils/errorHandler';
import { useStore } from '../../lib/store';

export async function handleErrorForAssistant(
  error: Error,
  errorMessage?: string,
  category?: string,
  context: string = 'unknown',
): Promise<void> {
  try {
    const msg = errorMessage || formatErrorMessage(error);
    const cat = category || categorizeError(error).category;

    const state = useStore.getState();
    const { network, activeTab } = state;

    const { analyzeError } = await import('../../lib/debugAssistant/ErrorPatternAnalyzer');
    const { getRecommendations, recordSolutionFeedback } = await import('../../lib/debugAssistant/SolutionRecommender');

    const analysis = await analyzeError(error, context, network, activeTab);

    const solutions = await getRecommendations(error, cat, context);

    if (analysis.suggestedActions.length > 0 && solutions.length > 0) {
      const topSolution = solutions[0];
      await recordSolutionFeedback(
        msg,
        cat,
        context,
        topSolution.title,
        null,
        { network, activeTab, analysisConfidence: analysis.confidence },
      );
    }

    useStore.setState({ debugAssistantIssueCount: state.debugAssistantIssueCount + 1 });
  } catch {
    // Non-critical
  }
}

export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return;

  const originalHandler = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (error) {
      handleErrorForAssistant(error, String(message), undefined, 'global-handler').catch(() => {});
    }
    if (originalHandler) {
      return originalHandler.call(window, message, source, lineno, colno, error);
    }
    return false;
  };

  const originalRejectionHandler = window.onunhandledrejection;
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    handleErrorForAssistant(error, undefined, undefined, 'unhandled-rejection').catch(() => {});
    if (originalRejectionHandler) {
      originalRejectionHandler.call(window, event);
    }
  };
}
