/**
 * Hook for accessing and managing rate limiter statistics and settings
 * Provides real-time visibility into queue depth, request rates, and throttle mode
 */

import { useEffect, useState, useCallback } from 'react'
import { rateLimiter } from '../lib/rateLimiter'

export interface RateLimiterStats {
  totalRequests: number
  queuedRequests: number
  batchedRequests: number
  rejectedRequests: number
  droppedRequests: number
  averageResponseTime: number
  queueSizes: {
    high: number
    medium: number
    low: number
  }
  totalQueued: number
  activeBuckets: number
  throttleMode: 'aggressive' | 'conservative'
  maxQueueSize: number
  timestamp: number
}

export type ThrottleMode = 'aggressive' | 'conservative';

export interface UseRateLimiterReturn {
  stats: RateLimiterStats | null;
  throttleMode: ThrottleMode;
  setMode: (mode: ThrottleMode) => void;
  getMode: () => ThrottleMode;
}

const REFRESH_INTERVAL_MS = 1000

export function useRateLimiter(): UseRateLimiterReturn {
  const [stats, setStats] = useState<RateLimiterStats | null>(null)
  const [throttleMode, setThrottleMode] = useState<ThrottleMode>('aggressive')

  // Refresh statistics on interval
  useEffect(() => {
    const updateStats = () => {
      const currentStats = rateLimiter.getStatistics()
      setStats(currentStats)
      setThrottleMode(currentStats.throttleMode)
    }

    updateStats() // Initial update
    const interval = setInterval(updateStats, REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])

  // Update throttle mode in rate limiter
  const setMode = useCallback((mode: ThrottleMode): void => {
    rateLimiter.setThrottleMode(mode)
    setThrottleMode(mode)
  }, [])

  // Get current mode
  const getMode = useCallback((): ThrottleMode => rateLimiter.getThrottleMode() as ThrottleMode, [])

  return {
    stats,
    throttleMode,
    setMode,
    getMode,
  }
}

export default useRateLimiter
