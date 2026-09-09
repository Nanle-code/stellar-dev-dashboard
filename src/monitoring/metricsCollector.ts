export interface SystemMetrics {
  timestamp: string;
  cpuUsagePct: number;
  memoryUsagePct: number;
  networkLatencyMs: number;
  errorCount5m: number;
  diskIoUtilPct: number;
}

export class MetricsCollector {
  private metricsHistory: SystemMetrics[] = [];

  public ingestMetrics(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift(); // keep rolling window
    }
  }

  public getRecentHistory(limit = 10): SystemMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  public getAverageMetric(key: keyof Omit<SystemMetrics, 'timestamp'>): number {
    if (this.metricsHistory.length === 0) return 0;
    const sum = this.metricsHistory.reduce((acc, curr) => acc + (curr[key] as number), 0);
    return sum / this.metricsHistory.length;
  }
}