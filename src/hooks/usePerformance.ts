import { useEffect, useCallback, useState } from 'react';
import { initPerformanceMonitoring } from '../lib/performanceMonitoring';
import { trackPerformanceMetric, trackPageView } from '../utils/analytics';

/**
 * usePerformance - React hook for performance monitoring and Core Web Vitals
 * Measures and reports performance metrics and user interactions
 *
 * @param componentName - Optional component name used for metric labels and page-view tracking
 * @returns Performance timing helpers and current metrics
 */
export interface PerformanceMetrics {
  domContentLoaded: number;
  loadComplete: number;
  ttfb: number;
  domInteractive: number;
  resourcesCount: number;
  totalResourceSize: number;
}

export interface UsePerformanceReturn {
  startTimer: () => number;
  endTimer: (startTime: number, metricName?: string | null) => number;
  measureApiCall: <T>(apiFunction: () => Promise<T>, endpoint: string, method?: string) => Promise<T>;
  metrics: PerformanceMetrics | null;
  vitals: null;
  getMetrics: () => PerformanceMetrics | null;
}

export const usePerformance = (componentName: string | null = null): UsePerformanceReturn => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [vitals, setVitals] = useState<null>(null);

  // Initialize performance monitoring
  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  // Measure component render time
  const startTimer = useCallback((): number => {
    return performance.now();
  }, []);

  const endTimer = useCallback((startTime: number, metricName?: string | null): number => {
    const duration = performance.now() - startTime;
    trackPerformanceMetric(metricName || componentName, duration, 'ms');
    return duration;
  }, [componentName]);

  // Track API call duration
  const measureApiCall = useCallback(async <T>(apiFunction: () => Promise<T>, endpoint: string, method: string = 'GET'): Promise<T> => {
    const startTime = startTimer();
    try {
      const result = await apiFunction();
      const duration = endTimer(startTime, `api_call_${endpoint}`);
      trackPerformanceMetric(`${method} ${endpoint}`, duration, 'ms');
      return result;
    } catch (error) {
      const duration = endTimer(startTime, `api_call_${endpoint}_error`);
      trackPerformanceMetric(`${method} ${endpoint} (error)`, duration, 'ms');
      throw error;
    }
  }, [startTimer, endTimer]);

  // Get current performance metrics
  const getMetrics = useCallback((): PerformanceMetrics | null => {
    if (typeof window === 'undefined') return null;

    const perfData = window.performance;
    if (!perfData) return null;

    const navigation = perfData.getEntriesByType('navigation')[0];
    if (!navigation) return null;

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
      resourcesCount: perfData.getEntriesByType('resource').length,
      totalResourceSize: perfData.getEntriesByType('resource').reduce(
        (sum, r) => sum + (r.transferSize || 0),
        0
      ),
    };
  }, []);

  // Update metrics periodically
  useEffect(() => {
    const newMetrics = getMetrics();
    setMetrics(newMetrics);

    const interval = setInterval(() => {
      setMetrics(getMetrics());
    }, 5000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  // Track page view on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && componentName) {
      trackPageView(window.location.pathname, componentName);
    }
  }, [componentName]);

  return {
    startTimer,
    endTimer,
    measureApiCall,
    metrics,
    vitals,
    getMetrics,
  };
};

export default usePerformance;
