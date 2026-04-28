import { useEffect, useCallback, useState } from 'react';
import { initPerformanceMonitoring } from '../lib/performanceMonitoring';
import { trackPerformanceMetric, trackPageView } from '../utils/analytics';

/**
 * usePerformance - React hook for performance monitoring and Core Web Vitals
 * Measures and reports performance metrics and user interactions
 */
export const usePerformance = (componentName = null) => {
  const [metrics, setMetrics] = useState(null);
  const [vitals, setVitals] = useState(null);

  // Initialize performance monitoring
  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  // Measure component render time
  const startTimer = useCallback(() => {
    return performance.now();
  }, []);

  const endTimer = useCallback((startTime, metricName) => {
    const duration = performance.now() - startTime;
    trackPerformanceMetric(metricName || componentName, duration, 'ms');
    return duration;
  }, [componentName]);

  // Track API call duration
  const measureApiCall = useCallback(async (apiFunction, endpoint, method = 'GET') => {
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
  const getMetrics = useCallback(() => {
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
