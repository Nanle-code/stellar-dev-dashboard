import React, { Component, ReactElement, ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';
import { IntelligentErrorRecovery } from './errors/IntelligentErrorRecovery';
import { handleGlobalError, retryWithBackoff as retryUtil, categorizeError, formatErrorMessage } from '../utils/errorHandler';
import { createLogger } from '../utils/logger';
import { ErrorDetails } from '../types/error';
import { selfHealingManager } from '../lib/errorHandling/SelfHealingManager';
import { analyzeError, type RecoveryGuidance } from '../lib/errorHandling/ErrorRecoveryEngine';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactElement;
  onRetry?: () => Promise<void>;
  maxRetries?: number;
  /** Show intelligent error recovery guidance alongside the fallback */
  showIntelligentRecovery?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorDetails: ErrorDetails | null;
  retryCount: number;
  isRetrying: boolean;
  recoveryGuidance: RecoveryGuidance | null;
}

const logger = createLogger('ErrorBoundary');

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorDetails: null,
      retryCount: 0,
      isRetrying: false,
      recoveryGuidance: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorDetails = handleGlobalError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      props: this.props,
      retryCount: this.state.retryCount,
    });

    // Generate intelligent recovery guidance
    const recoveryGuidance = analyzeError(error, { context: 'ErrorBoundary' });

    logger.error('Caught error in ErrorBoundary', {
      errorBoundary: this.constructor.name,
      retryCount: this.state.retryCount,
      recoverySolutions: recoveryGuidance.solutions.length,
    }, error);

    this.setState({ errorDetails, recoveryGuidance });

    // D-057 — Trigger self-healing for any degraded network services
    // that may have caused this render error indirectly.
    const statuses = selfHealingManager.getStatuses();
    const unhealthy = [...statuses.values()].filter(
      (s) => s.health === 'degraded' || s.health === 'down'
    );
    if (unhealthy.length > 0) {
      Promise.allSettled(
        unhealthy.map((s) => selfHealingManager.healNow(s.id))
      ).catch(() => {});
    }

    // AI-Enhanced Debug Assistant integration
    this.notifyDebugAssistant(error);
  }

  private async notifyDebugAssistant(error: Error) {
    try {
      const { useStore } = await import('../lib/store');
      const state = useStore.getState();
      if (!state) return;

      const errorMessage = formatErrorMessage(error);
      const { category } = categorizeError(error);

      const { handleErrorForAssistant } = await import('./debug/DebugAssistantIntegration');
      handleErrorForAssistant(error, errorMessage, category, 'ErrorBoundary').catch(() => {});
    } catch {
      // Non-critical: assistant integration should not break error handling
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorDetails: null,
      isRetrying: false,
      recoveryGuidance: null,
    });
  };

  retryWithBackoff = async () => {
    const { onRetry } = this.props;
    const { retryCount } = this.state;
    this.setState({ isRetrying: true });
    try {
      if (onRetry) {
        await retryUtil(onRetry, 3, 'ErrorBoundary');
      }
      this.setState({
        hasError: false,
        error: null,
        errorDetails: null,
        retryCount: retryCount + 1,
        isRetrying: false,
      });
    } catch (retryError) {
      const retryErrorDetails = handleGlobalError(retryError as Error, 'ErrorBoundary Retry', {
        originalError: this.state.error,
        retryAttempt: retryCount + 1,
      });
      this.setState({
        errorDetails: retryErrorDetails,
        retryCount: retryCount + 1,
        isRetrying: false,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return React.cloneElement(this.props.fallback, {
          error: this.state.error,
          errorDetails: this.state.errorDetails,
          resetErrorBoundary: this.resetErrorBoundary,
          retryWithBackoff: this.retryWithBackoff,
          isRetrying: this.state.isRetrying,
          retryCount: this.state.retryCount,
        });
      }
      return (
        <div>
          <ErrorFallback
            error={this.state.error}
            errorDetails={this.state.errorDetails}
            resetErrorBoundary={this.resetErrorBoundary}
            retryWithBackoff={this.retryWithBackoff}
            isRetrying={this.state.isRetrying}
            retryCount={this.state.retryCount}
            maxRetries={this.props.maxRetries ?? 3}
          />
          {this.props.showIntelligentRecovery !== false && this.state.recoveryGuidance && (
            <div style={{ marginTop: '16px' }}>
              <IntelligentErrorRecovery
                guidance={this.state.recoveryGuidance}
                onClose={this.resetErrorBoundary}
              />
            </div>
          )}
        </div>
      );
    }
    return this.props.children as ReactNode;
  }
}
