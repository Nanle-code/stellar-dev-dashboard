import { SystemMetrics } from './metricsCollector';
import { PredictionResult } from './failurePredictor';

export interface AlertNotification {
  alertId: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  recommendedAction: string;
  timestamp: string;
}

export interface RootCauseReport {
  primaryCause: string;
  secondaryCauses: string[];
  remediationPlan: string[];
  alerts: AlertNotification[];
}

export class RootCauseAnalyzer {
  public analyzeAndAlert(
    prediction: PredictionResult,
    currentMetrics: SystemMetrics
  ): RootCauseReport {
    const alerts: AlertNotification[] = [];
    const secondaryCauses: string[] = [];
    const remediationPlan: string[] = [];

    let primaryCause = 'System Operating Normally';

    if (prediction.riskLevel === 'CRITICAL' || prediction.riskLevel === 'HIGH') {
      // Isolate primary driver
      if (currentMetrics.memoryUsagePct > 85) {
        primaryCause = 'Memory Saturation / Heap Exhaustion';
        remediationPlan.push('Trigger automated garbage collection or restart worker process.');
        remediationPlan.push('Inspect recent heap snapshot for memory leaks.');
      } else if (currentMetrics.cpuUsagePct > 85) {
        primaryCause = 'CPU Core Starvation';
        remediationPlan.push('Autoscale node instances or increase CPU allocation.');
        remediationPlan.push('Profile event loop / execution bottlenecks.');
      } else if (currentMetrics.errorCount5m >= 15) {
        primaryCause = 'Uncaught Application Exception Cascade';
        remediationPlan.push('Review recent error logs in monitoring dashboard.');
        remediationPlan.push('Roll back latest deployment if error rate correlates with release window.');
      } else {
        primaryCause = 'Network IO Bottleneck / External Service Degraded';
        remediationPlan.push('Check upstream Stellar RPC node health and connection pools.');
      }

      // Populate secondary causes
      prediction.contributingFactors.forEach((factor) => {
        if (!factor.includes(primaryCause)) {
          secondaryCauses.push(factor);
        }
      });

      // Generate proactive early warning alert
      alerts.push({
        alertId: `ALERT-${Date.now()}`,
        severity: prediction.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        message: `Proactive Alert: High failure probability (${Math.round(
          prediction.failureProbability * 100
        )}%). Estimated failure in ${prediction.estimatedTimeToFailureMins || 'N/A'} mins.`,
        recommendedAction: remediationPlan[0] || 'Investigate active metrics immediately.',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      primaryCause,
      secondaryCauses,
      remediationPlan,
      alerts,
    };
  }
}