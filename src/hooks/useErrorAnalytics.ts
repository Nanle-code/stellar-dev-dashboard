import { useState, useEffect, useCallback } from 'react';
import { ErrorCategory } from '../lib/errorHandling';

interface ErrorRecord {
  category: ErrorCategory;
  message: string;
  timestamp: number;
  retryable: boolean;
  context?: any;
}

interface ErrorTrend {
  timestamp: number;
  count: number;
}

const ERROR_STORAGE_KEY = 'error-analytics';
const MAX_STORED_ERRORS = 1000;

export function useErrorAnalytics() {
  const [analytics, setAnalytics] = useState<ErrorRecord[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(ERROR_STORAGE_KEY);
    if (stored) {
      try {
        setAnalytics(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse error analytics', e);
      }
    }
  }, []);

  const recordError = useCallback((error: ErrorRecord) => {
    setAnalytics(prev => {
      const updated = [error, ...prev].slice(0, MAX_STORED_ERRORS);
      localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAnalytics = useCallback(() => {
    setAnalytics([]);
    localStorage.removeItem(ERROR_STORAGE_KEY);
  }, []);

  const trends = analytics.reduce((acc, error) => {
    const hour = Math.floor(error.timestamp / 3600000) * 3600000;
    const existing = acc.find(t => t.timestamp === hour);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ timestamp: hour, count: 1 });
    }
    return acc;
  }, [] as ErrorTrend[]).sort((a, b) => a.timestamp - b.timestamp);

  const topErrors = Object.entries(
    analytics.reduce((acc, e) => {
      acc[e.message] = (acc[e.message] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, 10);

  return { analytics, trends, topErrors, recordError, clearAnalytics };
}
