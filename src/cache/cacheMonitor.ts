export interface CacheAccessLog {
  key: string;
  timestamp: number;
  hit: boolean;
  latencyMs: number;
  dataAgeSeconds: number;
}

export interface CachePerformanceMetrics {
  totalRequests: number;
  hitCount: number;
  missCount: number;
  hitRatePct: number;
  avgLatencyMs: number;
  memoryUsagePct: number;
  evictionCount: number;
}

export class CacheMonitor {
  private accessLogs: CacheAccessLog[] = [];
  private totalHits = 0;
  private totalMisses = 0;
  private evictions = 0;

  public recordAccess(log: CacheAccessLog): void {
    this.accessLogs.push(log);
    if (log.hit) {
      this.totalHits++;
    } else {
      this.totalMisses++;
    }

    if (this.accessLogs.length > 500) {
      this.accessLogs.shift(); // Keep rolling window
    }
  }

  public recordEviction(): void {
    this.evictions++;
  }

  public getMetrics(memoryUsagePct = 50): CachePerformanceMetrics {
    const totalRequests = this.totalHits + this.totalMisses;
    const hitRatePct = totalRequests > 0 ? parseFloat(((this.totalHits / totalRequests) * 100).toFixed(2)) : 0;
    
    const sumLatency = this.accessLogs.reduce((acc, curr) => acc + curr.latencyMs, 0);
    const avgLatencyMs = this.accessLogs.length > 0 ? parseFloat((sumLatency / this.accessLogs.length).toFixed(2)) : 0;

    return {
      totalRequests,
      hitCount: this.totalHits,
      missCount: this.totalMisses,
      hitRatePct,
      avgLatencyMs,
      memoryUsagePct,
      evictionCount: this.evictions,
    };
  }

  public getAccessFrequencyMap(): Record<string, number> {
    const freqMap: Record<string, number> = {};
    for (const log of this.accessLogs) {
      freqMap[log.key] = (freqMap[log.key] || 0) + 1;
    }
    return freqMap;
  }
}