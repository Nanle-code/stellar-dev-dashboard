import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LandscapeAnalyticsLayout from '../LandscapeAnalyticsLayout';
import { useResponsive } from '../../../hooks/useResponsive';

// Mock useResponsive hook for controlled testing
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));

const mockUseResponsive = vi.mocked(useResponsive);

describe('<LandscapeAnalyticsLayout />', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseResponsive.mockReturnValue({
      windowWidth: 1024,
      windowHeight: 768,
      orientation: 'landscape',
      isLandscape: true,
      isPortrait: false,
      isTabletLandscape: true,
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      breakpoints: { mobile: 768, tablet: 1024, desktop: 1200 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Primary Flow', () => {
    it('renders landscape layout with orientation badge and side-by-side composition', () => {
      render(
        <LandscapeAnalyticsLayout title="Tablet Analytics" data={[{ id: 1 }]}>
          <div data-testid="chart-1">Primary Activity Chart</div>
        </LandscapeAnalyticsLayout>
      );

      expect(screen.getByText('Tablet Analytics')).toBeInTheDocument();
      expect(screen.getByText('Tablet Landscape Composition')).toBeInTheDocument();
      expect(screen.getByTestId('chart-1')).toBeInTheDocument();
      const layoutContainer = screen.getByTestId('chart-1').closest('.landscape-analytics-layout');
      expect(layoutContainer).toHaveAttribute('data-orientation', 'landscape');
      expect(layoutContainer).toHaveAttribute('data-landscape-active', 'true');
    });

    it('renders side-by-side panel layout when sidePanel is provided in landscape mode', () => {
      render(
        <LandscapeAnalyticsLayout
          title="Side-by-Side View"
          data={[{ id: 1 }]}
          sidePanel={<div data-testid="side-panel">Control Panel</div>}
        >
          <div data-testid="main-chart">Main Chart</div>
        </LandscapeAnalyticsLayout>
      );

      expect(screen.getByTestId('main-chart')).toBeInTheDocument();
      expect(screen.getByTestId('side-panel')).toBeInTheDocument();
    });

    it('toggles composition mode between side-by-side and stacked view via view mode buttons', () => {
      render(
        <LandscapeAnalyticsLayout title="Toggle View" data={[{ id: 1 }]}>
          <div data-testid="chart-content">Chart Content</div>
        </LandscapeAnalyticsLayout>
      );

      const stackedButton = screen.getByRole('button', { name: /stacked view/i });
      fireEvent.click(stackedButton);

      const layoutContainer = screen
        .getByTestId('chart-content')
        .closest('.landscape-analytics-layout');
      expect(layoutContainer).toHaveAttribute('data-landscape-active', 'false');

      const sideBySideButton = screen.getByRole('button', { name: /side-by-side view/i });
      fireEvent.click(sideBySideButton);
      expect(layoutContainer).toHaveAttribute('data-landscape-active', 'true');
    });
  });

  describe('Boundary Cases', () => {
    it('handles exact tablet breakpoint boundary (768px x 600px landscape)', () => {
      mockUseResponsive.mockReturnValue({
        windowWidth: 768,
        windowHeight: 600,
        orientation: 'landscape',
        isLandscape: true,
        isPortrait: false,
        isTabletLandscape: true,
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        breakpoints: { mobile: 768, tablet: 1024, desktop: 1200 },
      });

      render(
        <LandscapeAnalyticsLayout title="Boundary View" data={[{ id: 1 }]}>
          <div data-testid="boundary-chart">Boundary Chart</div>
        </LandscapeAnalyticsLayout>
      );

      expect(screen.getByTestId('boundary-chart')).toBeInTheDocument();
      expect(screen.getByText('Tablet Landscape Composition')).toBeInTheDocument();
    });

    it('handles empty dataset gracefully without error alerts', () => {
      render(
        <LandscapeAnalyticsLayout title="Empty Data View" data={[]}>
          <div data-testid="empty-chart">No Data Chart</div>
        </LandscapeAnalyticsLayout>
      );

      expect(screen.getByTestId('empty-chart')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders multiple charts side-by-side when charts array is provided', () => {
      render(
        <LandscapeAnalyticsLayout
          title="Multi Chart View"
          charts={[
            <div key="c1" data-testid="chart-alpha">
              Chart Alpha
            </div>,
            <div key="c2" data-testid="chart-beta">
              Chart Beta
            </div>,
          ]}
        />
      );

      expect(screen.getByTestId('chart-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('chart-beta')).toBeInTheDocument();
    });
  });

  describe('Failure Cases & Error Handling', () => {
    it('handles invalid input data (null or NaN) with explicit alert message', () => {
      render(
        <LandscapeAnalyticsLayout
          title="Invalid Data Test"
          data={null}
          fallbackMessage="Data processing failed"
        >
          <div>Chart Content</div>
        </LandscapeAnalyticsLayout>
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Data processing failed: Data is null');
    });

    it('handles unsupported environment (portrait mode fallback)', () => {
      mockUseResponsive.mockReturnValue({
        windowWidth: 400,
        windowHeight: 800,
        orientation: 'portrait',
        isLandscape: false,
        isPortrait: true,
        isTabletLandscape: false,
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        breakpoints: { mobile: 768, tablet: 1024, desktop: 1200 },
      });

      render(
        <LandscapeAnalyticsLayout title="Portrait Fallback" data={[{ id: 1 }]}>
          <div data-testid="portrait-chart">Portrait Chart</div>
        </LandscapeAnalyticsLayout>
      );

      expect(screen.getByTestId('portrait-chart')).toBeInTheDocument();
      expect(screen.queryByText('Tablet Landscape Composition')).not.toBeInTheDocument();
    });

    it('catches child component render error with ErrorBoundary and allows retry', () => {
      const ErrorChild = () => {
        throw new Error('Broken chart rendering');
      };

      const onErrorSpy = vi.fn();

      // Suppress console.error output during error boundary test
      const originalConsoleError = console.error;
      console.error = vi.fn();

      render(
        <LandscapeAnalyticsLayout onError={onErrorSpy}>
          <ErrorChild />
        </LandscapeAnalyticsLayout>
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Broken chart rendering');
      expect(screen.getByRole('button', { name: /retry landscape view/i })).toBeInTheDocument();
      expect(onErrorSpy).toHaveBeenCalled();

      console.error = originalConsoleError;
    });
  });
});
