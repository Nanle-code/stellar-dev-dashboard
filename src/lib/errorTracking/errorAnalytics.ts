/**
 * Error Analytics and SLA Tracking System
 * Provides comprehensive error analysis, trends, and SLA monitoring
 */

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number; // errors per minute
  uniqueErrors: number;
  criticalErrors: number;
  highErrors: number;
  mediumErrors: number;
  lowErrors: number;
  resolvedErrors: number;
  unresolvedErrors: number;
  avgResolutionTime: number;
  avgResponseTime: number;
}

export interface ErrorTrend {
  timestamp: number;
  errorCount: number;
  errorRate: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface SLAMetrics {
  slaTarget: number; // target response time in minutes
  slaCompliance: number; // percentage of errors resolved within SLA
  avgResponseTime: number;
  avgResolutionTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  p50ResolutionTime: number;
  p90ResolutionTime: number;
  p95ResolutionTime: number;
  p99ResolutionTime: number;
  currentSlaStatus: 'compliant' | 'warning' | 'breached';
}

export interface ErrorFrequency {
  errorName: string;
  errorMessage: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  avgImpact: number;
}

export class ErrorAnalyticsManager {
  private errorHistory: Array<{
    id: string;
    timestamp: number;
    severity: string;
    resolvedAt: number | null;
    respondedAt: number | null;
    category: string;
  }> = [];
  private slaTarget: number; // minutes
  private trends: ErrorTrend[] = [];

  constructor(slaTargetMinutes: number = 30) {
    this.slaTarget = slaTargetMinutes;
  }

  /**
   * Record an error occurrence
   */
  recordError(error: {
    id: string;
    severity: string;
    category: string;
  }): void {
    this.errorHistory.push({
      id: error.id,
      timestamp: Date.now(),
      severity: error.severity,
      resolvedAt: null,
      respondedAt: null,
      category: error.category
    });

    this.updateTrends();
  }

  /**
   * Mark error as responded
   */
  markResponded(errorId: string): void {
    const error = this.errorHistory.find(e => e.id === errorId);
    if (error && !error.respondedAt) {
      error.respondedAt = Date.now();
    }
  }

  /**
   * Mark error as resolved
   */
  markResolved(errorId: string): void {
    const error = this.errorHistory.find(e => e.id === errorId);
    if (error && !error.resolvedAt) {
      error.resolvedAt = Date.now();
    }
  }

  /**
   * Get current error metrics
   */
  getMetrics(timeWindowMs: number = 3600000): ErrorMetrics {
    const now = Date.now();
    const windowStart = now - timeWindowMs;
    
    const recentErrors = this.errorHistory.filter(e => e.timestamp >= windowStart);
    
    const totalErrors = recentErrors.length;
    const uniqueErrors = new Set(recentErrors.map(e => e.category)).size;
    
    const severityCounts = {
      critical: recentErrors.filter(e => e.severity === 'critical').length,
      high: recentErrors.filter(e => e.severity === 'high').length,
      medium: recentErrors.filter(e => e.severity === 'medium').length,
      low: recentErrors.filter(e => e.severity === 'low').length
    };

    const resolvedErrors = recentErrors.filter(e => e.resolvedAt !== null).length;
    const unresolvedErrors = totalErrors - resolvedErrors;

    const responseTimes = recentErrors
      .filter(e => e.respondedAt !== null)
      .map(e => (e.respondedAt! - e.timestamp) / 60000); // convert to minutes

    const resolutionTimes = recentErrors
      .filter(e => e.resolvedAt !== null)
      .map(e => (e.resolvedAt! - e.timestamp) / 60000);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    const errorRate = timeWindowMs > 0
      ? (totalErrors / (timeWindowMs / 60000))
      : 0;

    return {
      totalErrors,
      errorRate,
      uniqueErrors,
      criticalErrors: severityCounts.critical,
      highErrors: severityCounts.high,
      mediumErrors: severityCounts.medium,
      lowErrors: severityCounts.low,
      resolvedErrors,
      unresolvedErrors,
      avgResolutionTime,
      avgResponseTime
    };
  }

  /**
   * Get error trends over time
   */
  getTrends(hours: number = 24): ErrorTrend[] {
    const now = Date.now();
    const startTime = now - (hours * 3600000);
    
    return this.trends.filter(t => t.timestamp >= startTime);
  }

  /**
   * Update trend data
   */
  private updateTrends(): void {
    const now = Date.now();
    const windowMs = 300000; // 5 minutes
    
    const recentErrors = this.errorHistory.filter(
      e => e.timestamp >= now - windowMs
    );

    const severityBreakdown = {
      critical: recentErrors.filter(e => e.severity === 'critical').length,
      high: recentErrors.filter(e => e.severity === 'high').length,
      medium: recentErrors.filter(e => e.severity === 'medium').length,
      low: recentErrors.filter(e => e.severity === 'low').length
    };

    this.trends.push({
      timestamp: now,
      errorCount: recentErrors.length,
      errorRate: recentErrors.length / (windowMs / 60000),
      severityBreakdown
    });

    // Keep only last 1000 trend points
    if (this.trends.length > 1000) {
      this.trends.shift();
    }
  }

  /**
   * Get SLA metrics
   */
  getSLAMetrics(): SLAMetrics {
    const resolvedErrors = this.errorHistory.filter(e => e.resolvedAt !== null);
    
    if (resolvedErrors.length === 0) {
      return {
        slaTarget: this.slaTarget,
        slaCompliance: 100,
        avgResponseTime: 0,
        avgResolutionTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        p50ResolutionTime: 0,
        p90ResolutionTime: 0,
        p95ResolutionTime: 0,
        p99ResolutionTime: 0,
        currentSlaStatus: 'compliant'
      };
    }

    const responseTimes = resolvedErrors
      .filter(e => e.respondedAt !== null)
      .map(e => (e.respondedAt! - e.timestamp) / 60000)
      .sort((a, b) => a - b);

    const resolutionTimes = resolvedErrors
      .map(e => (e.resolvedAt! - e.timestamp) / 60000)
      .sort((a, b) => a - b);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const avgResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;

    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    const slaCompliantCount = resolutionTimes.filter(t => t <= this.slaTarget).length;
    const slaCompliance = (slaCompliantCount / resolutionTimes.length) * 100;

    let currentSlaStatus: 'compliant' | 'warning' | 'breached' = 'compliant';
    if (slaCompliance < 90) currentSlaStatus = 'breached';
    else if (slaCompliance < 95) currentSlaStatus = 'warning';

    return {
      slaTarget: this.slaTarget,
      slaCompliance,
      avgResponseTime,
      avgResolutionTime,
      p50ResponseTime: percentile(responseTimes, 50),
      p90ResponseTime: percentile(responseTimes, 90),
      p95ResponseTime: percentile(responseTimes, 95),
      p99ResponseTime: percentile(responseTimes, 99),
      p50ResolutionTime: percentile(resolutionTimes, 50),
      p90ResolutionTime: percentile(resolutionTimes, 90),
      p95ResolutionTime: percentile(resolutionTimes, 95),
      p99ResolutionTime: percentile(resolutionTimes, 99),
      currentSlaStatus
    };
  }

  /**
   * Get error frequency analysis
   */
  getErrorFrequency(limit: number = 20): ErrorFrequency[] {
    const errorMap = new Map<string, {
      count: number;
      timestamps: number[];
      category: string;
    }>();

    this.errorHistory.forEach(error => {
      const key = `${error.category}:${error.severity}`;
      const existing = errorMap.get(key) || {
        count: 0,
        timestamps: [],
        category: error.category
      };
      
      existing.count++;
      existing.timestamps.push(error.timestamp);
      errorMap.set(key, existing);
    });

    const total = this.errorHistory.length;

    return Array.from(errorMap.entries())
      .map(([key, data]) => {
        const [category, severity] = key.split(':');
        
        // Calculate trend
        const recentCount = data.timestamps.filter(
          t => t >= Date.now() - 3600000
        ).length;
        const olderCount = data.timestamps.filter(
          t => t >= Date.now() - 7200000 && t < Date.now() - 3600000
        ).length;
        
        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (recentCount > olderCount * 1.5) trend = 'increasing';
        else if (recentCount < olderCount * 0.5) trend = 'decreasing';

        return {
          errorName: category,
          errorMessage: severity,
          count: data.count,
          percentage: total > 0 ? (data.count / total) * 100 : 0,
          trend,
          avgImpact: severity === 'critical' ? 10 : severity === 'high' ? 5 : severity === 'medium' ? 2 : 1
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get error impact analysis
   */
  getErrorImpact(): {
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    totalImpactScore: number;
  } {
    const metrics = this.getMetrics();
    
    const highImpact = metrics.criticalErrors * 10 + metrics.highErrors * 5;
    const mediumImpact = metrics.mediumErrors * 2;
    const lowImpact = metrics.lowErrors * 1;
    
    return {
      highImpact,
      mediumImpact,
      lowImpact,
      totalImpactScore: highImpact + mediumImpact + lowImpact
    };
  }

  /**
   * Set SLA target
   */
  setSLATarget(minutes: number): void {
    this.slaTarget = minutes;
  }

  /**
   * Clear old error history (older than 30 days)
   */
  cleanup(): void {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.errorHistory = this.errorHistory.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Export error data for analysis
   */
  exportData(): {
    errors: typeof this.errorHistory;
    trends: ErrorTrend[];
    metrics: ErrorMetrics;
    slaMetrics: SLAMetrics;
  } {
    return {
      errors: this.errorHistory,
      trends: this.trends,
      metrics: this.getMetrics(),
      slaMetrics: this.getSLAMetrics()
    };
  }
}

export function createErrorAnalyticsManager(slaTargetMinutes?: number): ErrorAnalyticsManager {
  return new ErrorAnalyticsManager(slaTargetMinutes);
}
