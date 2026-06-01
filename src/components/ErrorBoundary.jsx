import React from 'react';
import ErrorFallback from './ErrorFallback';
import { handleGlobalError, retryWithBackoff } from '../utils/errorHandler';
import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorBoundary');

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorDetails: null,
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Enhanced error handling with categorization
    const isChunkError = 
      error?.message?.includes('chunk') || 
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('loading chunk');
    
    const errorDetails = handleGlobalError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      props: this.props,
      retryCount: this.state.retryCount,
      isChunkError
    });

    logger.error('Caught error in ErrorBoundary', {
      errorBoundary: this.constructor.name,
      retryCount: this.state.retryCount,
      isChunkError,
      message: error?.message,
    }, error);

    this.setState({ errorDetails });
  }

  resetErrorBoundary = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorDetails: null,
      isRetrying: false
    });
  }

  retryWithBackoff = async () => {
    const { onRetry } = this.props;
    const { retryCount } = this.state;
    const isChunkError = 
      this.state.error?.message?.includes('chunk') || 
      this.state.error?.message?.includes('Failed to fetch') ||
      this.state.error?.message?.includes('loading chunk');

    this.setState({ isRetrying: true });

    try {
      if (isChunkError) {
        // For chunk loading errors, clear service worker cache and reload
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        // Do a hard refresh to clear browser cache
        window.location.reload();
        return;
      }
      
      if (onRetry) {
        await retryWithBackoff(onRetry, 3, 'ErrorBoundary');
      }
      
      // Reset error state on successful retry
      this.setState({ 
        hasError: false, 
        error: null, 
        errorDetails: null,
        retryCount: retryCount + 1,
        isRetrying: false
      });
    } catch (retryError) {
      // Handle retry failure
      const retryErrorDetails = handleGlobalError(retryError, 'ErrorBoundary Retry', {
        originalError: this.state.error,
        retryAttempt: retryCount + 1
      });

      this.setState({ 
        errorDetails: retryErrorDetails,
        retryCount: retryCount + 1,
        isRetrying: false
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        return React.cloneElement(this.props.fallback, {
          error: this.state.error,
          errorDetails: this.state.errorDetails,
          resetErrorBoundary: this.resetErrorBoundary,
          retryWithBackoff: this.retryWithBackoff,
          isRetrying: this.state.isRetrying,
          retryCount: this.state.retryCount
        });
      }

      // Default enhanced fallback
      return (
        <ErrorFallback 
          error={this.state.error}
          errorDetails={this.state.errorDetails}
          resetErrorBoundary={this.resetErrorBoundary}
          retryWithBackoff={this.retryWithBackoff}
          isRetrying={this.state.isRetrying}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries || 3}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
