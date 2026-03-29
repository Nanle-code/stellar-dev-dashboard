import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-bg-surface rounded-lg border border-border">
      <div className="bg-red-glow p-4 rounded-full mb-6">
        <AlertTriangle className="w-10 h-10 text-red" />
      </div>
      
      <h2 className="text-2xl font-display font-semibold mb-2 text-text-primary">
        Something went wrong
      </h2>
      
      <p className="text-text-secondary mb-6 max-w-md">
        We've encountered an unexpected error. Our team has been notified.
      </p>
      
      <div className="bg-bg-elevated p-4 rounded-md w-full max-w-lg mb-8 text-left overflow-x-auto border border-border-bright">
        <code className="text-sm font-mono text-red">
          {error?.message || 'Unknown Error'}
        </code>
      </div>

      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-2 px-6 py-3 bg-cyan hover:bg-cyan-dim text-white font-medium rounded-md transition-colors shadow-lg"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
};

export default ErrorFallback;
