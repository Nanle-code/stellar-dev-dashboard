import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RouteErrorBoundary, { generateDiagnosticId } from '../RouteErrorBoundary';

const ThrowingComponent = ({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) => {
  if (shouldThrow) {
    throw new Error(message || 'Simulated route crash');
  }
  return <div data-testid="route-content">Healthy Route Content</div>;
};

describe('RouteErrorBoundary (Issue #822)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('generateDiagnosticId', () => {
    it('generates formatted diagnostic identifier with route prefix', () => {
      const id = generateDiagnosticId('contracts');
      expect(id).toMatch(/^ERR-CONTRACTS-[A-Z0-9]+-[A-Z0-9]+$/);
    });

    it('handles missing or symbol-heavy route names gracefully', () => {
      const id = generateDiagnosticId('/api/v1/@test#route');
      expect(id).toMatch(/^ERR-APIV1TESTR-[A-Z0-9]+-[A-Z0-9]+$/);
    });
  });

  describe('Primary Flow - Route Error Capture & Fallback', () => {
    it('renders child components normally when no error occurs', () => {
      render(
        <RouteErrorBoundary routeName="Overview" routePath="/overview">
          <ThrowingComponent shouldThrow={false} />
        </RouteErrorBoundary>
      );

      expect(screen.getByTestId('route-content')).toBeInTheDocument();
      expect(screen.queryByTestId('route-error-boundary-fallback')).not.toBeInTheDocument();
    });

    it('captures render error, displays route context, and surfaces diagnostic ID', () => {
      render(
        <RouteErrorBoundary routeName="Transaction Explorer" routePath="/transactions">
          <ThrowingComponent shouldThrow={true} message="Failed to load ledger transactions" />
        </RouteErrorBoundary>
      );

      expect(screen.getByTestId('route-error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByText('Unable to Load Transaction Explorer')).toBeInTheDocument();
      expect(screen.getByText('Route: /transactions')).toBeInTheDocument();
      expect(screen.getByText('Failed to load ledger transactions')).toBeInTheDocument();

      const diagnosticTag = screen.getByTestId('diagnostic-identifier-tag');
      expect(diagnosticTag).toBeInTheDocument();
      expect(diagnosticTag.textContent).toContain('Diagnostic ID:');
    });

    it('triggers onRetry when Retry Route button is clicked', () => {
      const onRetry = vi.fn();

      render(
        <RouteErrorBoundary
          routeName="Contracts"
          routePath="/contracts"
          onRetry={onRetry}
        >
          <ThrowingComponent shouldThrow={true} />
        </RouteErrorBoundary>
      );

      const retryBtn = screen.getByTestId('route-retry-button');
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('triggers onNavigateHome when Return to Overview button is clicked', () => {
      const onNavigateHome = vi.fn();

      render(
        <RouteErrorBoundary
          routeName="Contracts"
          routePath="/contracts"
          onNavigateHome={onNavigateHome}
        >
          <ThrowingComponent shouldThrow={true} />
        </RouteErrorBoundary>
      );

      const homeBtn = screen.getByTestId('route-return-home-button');
      expect(homeBtn).toBeInTheDocument();
      fireEvent.click(homeBtn);
      expect(onNavigateHome).toHaveBeenCalledTimes(1);
    });
  });

  describe('Boundary Cases - Retry Exhaustion and Clipboard Diagnostic Copy', () => {
    it('exhausts retry attempts after maxRetries and removes retry button', () => {
      const onRetry = vi.fn();

      const { rerender } = render(
        <RouteErrorBoundary maxRetries={1} onRetry={onRetry}>
          <ThrowingComponent shouldThrow={true} />
        </RouteErrorBoundary>
      );

      const retryBtn = screen.getByTestId('route-retry-button');
      expect(retryBtn).toHaveTextContent('Retry Route (1 left)');

      fireEvent.click(retryBtn);

      // Component re-renders with error still throwing
      rerender(
        <RouteErrorBoundary maxRetries={1} onRetry={onRetry}>
          <ThrowingComponent shouldThrow={true} />
        </RouteErrorBoundary>
      );

      // Retry attempts exhausted
      expect(screen.queryByTestId('route-retry-button')).not.toBeInTheDocument();
    });

    it('copies diagnostic report to clipboard when copy button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <RouteErrorBoundary routeName="Analytics" routePath="/analytics">
          <ThrowingComponent shouldThrow={true} message="RPC Timeout" />
        </RouteErrorBoundary>
      );

      const copyBtn = screen.getByTestId('route-copy-diagnostic-button');
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedPayload = JSON.parse(writeTextMock.mock.calls[0][0]);
      expect(copiedPayload.routeName).toBe('Analytics');
      expect(copiedPayload.errorMessage).toBe('RPC Timeout');
      expect(copiedPayload.diagnosticId).toBeDefined();
    });
  });

  describe('Failure Cases - Missing Metadata or Empty Error Details', () => {
    it('gracefully handles missing routeName and routePath', () => {
      render(
        <RouteErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('View Rendering Failed')).toBeInTheDocument();
      expect(screen.getByTestId('diagnostic-identifier-tag')).toBeInTheDocument();
    });

    it('handles clipboard failure without unhandled promise rejections', () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard permission denied')),
        },
      });

      render(
        <RouteErrorBoundary routeName="Settings">
          <ThrowingComponent shouldThrow={true} />
        </RouteErrorBoundary>
      );

      const copyBtn = screen.getByTestId('route-copy-diagnostic-button');
      expect(() => fireEvent.click(copyBtn)).not.toThrow();
    });
  });
});
