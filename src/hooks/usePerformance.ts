import { useEffect, useCallback, useState } from 'react';
import { initPerformanceMonitoring } from '../lib/performanceMonitoring';
import { trackPerformanceMetric, trackPageView } from '../utils/analytics';

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
  endTimer: (startTime: number, metricName?: string) => number;
  measureApiCall: <T>(apiFunction: () => Promise<T>, endpoint: string, method?: string) => Promise<T>;
  metrics: PerformanceMetrics | null;
  vitals: null;
  getMetrics: () => PerformanceMetrics | null;
}

export const usePerformance = (componentName: string | null = null): UsePerformanceReturn => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  const startTimer = useCallback((): number => performance.now(), []);

  const endTimer = useCallback(
    (startTime: number, metricName?: string): number => {
      const duration = performance.now() - startTime;
      trackPerformanceMetric(metricName ?? componentName, duration, 'ms');
      return duration;
    },
    [componentName],
  );

  const measureApiCall = useCallback(
    async <T,>(apiFunction: () => Promise<T>, endpoint: string, method = 'GET'): Promise<T> => {
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
    },
    [startTimer, endTimer],
  );

  const getMetrics = useCallback((): PerformanceMetrics | null => {
    if (typeof window === 'undefined') return null;
    const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return null;
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
      resourcesCount: window.performance.getEntriesByType('resource').length,
      totalResourceSize: window.performance
        .getEntriesByType('resource')
        .reduce((sum, r) => sum + ((r as PerformanceResourceTiming).transferSize ?? 0), 0),
    };
  }, []);

  useEffect(() => {
    setMetrics(getMetrics());
    const interval = setInterval(() => setMetrics(getMetrics()), 5000);
    return () => clearInterval(interval);
  }, [getMetrics]);

  useEffect(() => {
    if (typeof window !== 'undefined' && componentName) {
      trackPageView(window.location.pathname, componentName);
    }
  }, [componentName]);

  return { startTimer, endTimer, measureApiCall, metrics, vitals: null, getMetrics };
};

export default usePerformance;
