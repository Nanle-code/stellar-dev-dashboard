import React, { Component, ReactElement, ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';
import { handleGlobalError, retryWithBackoff as retryUtil } from '../utils/errorHandler';
import { createLogger } from '../utils/logger';
import { ErrorDetails } from '../types/error';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactElement;
  onRetry?: () => Promise<void>;
  maxRetries?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorDetails: ErrorDetails | null;
  retryCount: number;
  isRetrying: boolean;
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

    logger.error('Caught error in ErrorBoundary', {
      errorBoundary: this.constructor.name,
      retryCount: this.state.retryCount,
    }, error);

    this.setState({ errorDetails });
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorDetails: null,
      isRetrying: false,
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
        <ErrorFallback
          error={this.state.error}
          errorDetails={this.state.errorDetails}
          resetErrorBoundary={this.resetErrorBoundary}
          retryWithBackoff={this.retryWithBackoff}
          isRetrying={this.state.isRetrying}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries ?? 3}
        />
      );
    }
    return this.props.children as ReactNode;
  }
}
