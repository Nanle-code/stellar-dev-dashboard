import { SystemMetrics } from './metricsCollector';

export interface PredictionResult {
  failureProbability: number; // 0.0 to 1.0
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedTimeToFailureMins: number | null;
  contributingFactors: string[];
}

export class FailurePredictor {
  public predictFailure(
    current: SystemMetrics,
    history: SystemMetrics[]
  ): PredictionResult {
    let riskScore = 0;
    const contributingFactors: string[] = [];

    // 1. CPU Load Analysis
    if (current.cpuUsagePct > 90) {
      riskScore += 0.35;
      contributingFactors.push(`Critical CPU utilization (${current.cpuUsagePct}%)`);
    } else if (current.cpuUsagePct > 75) {
      riskScore += 0.15;
      contributingFactors.push(`Elevated CPU load (${current.cpuUsagePct}%)`);
    }

    // 2. Memory Consumption & Leak Pattern
    if (current.memoryUsagePct > 90) {
      riskScore += 0.35;
      contributingFactors.push(`Critical Memory saturation (${current.memoryUsagePct}%)`);
    } else if (current.memoryUsagePct > 80) {
      riskScore += 0.2;
      contributingFactors.push(`High Memory utilization (${current.memoryUsagePct}%)`);
    }

    // Check for memory trend increase across recent history
    if (history.length >= 3) {
      const isMemoryRising = history.every((m, i, arr) => i === 0 || m.memoryUsagePct >= arr[i - 1].memoryUsagePct);
      if (isMemoryRising && current.memoryUsagePct > 70) {
        riskScore += 0.15;
        contributingFactors.push('Sustained memory growth pattern detected (potential leak)');
      }
    }

    // 3. Error Rate Spike
    if (current.errorCount5m >= 50) {
      riskScore += 0.4;
      contributingFactors.push(`High error log volume (${current.errorCount5m} errors in 5m)`);
    } else if (current.errorCount5m >= 15) {
      riskScore += 0.2;
      contributingFactors.push(`Moderate error log activity (${current.errorCount5m} errors in 5m)`);
    }

    // 4. Network Latency Degradation
    if (current.networkLatencyMs > 1000) {
      riskScore += 0.25;
      contributingFactors.push(`Severe latency degradation (${current.networkLatencyMs}ms)`);
    }

    // Normalize failure probability score between 0.0 and 1.0
    const failureProbability = parseFloat(Math.min(1.0, riskScore).toFixed(2));

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let estimatedTimeToFailureMins: number | null = null;

    if (failureProbability >= 0.8) {
      riskLevel = 'CRITICAL';
      estimatedTimeToFailureMins = 10;
    } else if (failureProbability >= 0.6) {
      riskLevel = 'HIGH';
      estimatedTimeToFailureMins = 30;
    } else if (failureProbability >= 0.35) {
      riskLevel = 'MEDIUM';
      estimatedTimeToFailureMins = 120;
    }

    return {
      failureProbability,
      riskLevel,
      estimatedTimeToFailureMins,
      contributingFactors,
    };
  }
}