import { MetricsCollector, SystemMetrics } from './metricsCollector';
import { FailurePredictor, PredictionResult } from './failurePredictor';
import { RootCauseAnalyzer, RootCauseReport } from './rootCauseAnalyzer';

export interface PredictiveHealthReport {
  timestamp: string;
  currentMetrics: SystemMetrics;
  prediction: PredictionResult;
  rootCauseAnalysis: RootCauseReport;
  systemStatus: 'HEALTHY' | 'DEGRADED' | 'AT_RISK' | 'CRITICAL';
}

export class PredictiveMonitoringService {
  private collector = new MetricsCollector();
  private predictor = new FailurePredictor();
  private analyzer = new RootCauseAnalyzer();

  public processSystemSnapshot(metrics: SystemMetrics): PredictiveHealthReport {
    // 1. Ingest metrics into history collector
    this.collector.ingestMetrics(metrics);
    const history = this.collector.getRecentHistory(10);

    // 2. Compute failure probability and risk
    const prediction = this.predictor.predictFailure(metrics, history);

    // 3. Perform root cause analysis and generate early warning alerts if necessary
    const rootCauseAnalysis = this.analyzer.analyzeAndAlert(prediction, metrics);

    // 4. Derive overall system health status
    let systemStatus: 'HEALTHY' | 'DEGRADED' | 'AT_RISK' | 'CRITICAL' = 'HEALTHY';
    if (prediction.riskLevel === 'CRITICAL') {
      systemStatus = 'CRITICAL';
    } else if (prediction.riskLevel === 'HIGH') {
      systemStatus = 'AT_RISK';
    } else if (prediction.riskLevel === 'MEDIUM') {
      systemStatus = 'DEGRADED';
    }

    return {
      timestamp: new Date().toISOString(),
      currentMetrics: metrics,
      prediction,
      rootCauseAnalysis,
      systemStatus,
    };
  }
}