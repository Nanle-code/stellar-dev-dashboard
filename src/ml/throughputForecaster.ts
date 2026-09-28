/**
 * Throughput Forecasting Model for Stellar Network
 * 
 * Predicts future transaction throughput (TPS/OPS) using:
 * - Adaptive Double Exponential Smoothing with regime-change detection
 * - Automatic alpha/beta adjustment when prediction error spikes
 * - Confidence intervals via residual analysis
 * 
 * Designed for client-side execution with minimal compute overhead.
 */

class ThroughputForecaster {
  constructor(config = {}) {
    this.baseAlpha = config.smoothingAlpha || config.baseAlpha || 0.3;
    this.baseBeta = config.smoothingBeta || config.baseBeta || 0.1;
    this.minDataPoints = config.minDataPoints || 10;
    this.ledgerCapacity = config.ledgerCapacity || 1000;
    this.confidenceLevel = config.confidenceLevel || 0.95;
    this.adaptiveEnabled = config.adaptiveEnabled !== false;
    this.regimeThreshold = config.regimeThreshold || 1.5;
    
    this.smoothingAlpha = this.baseAlpha;
    this.smoothingBeta = this.baseBeta;
    
    this.history = [];
    this.fitted = false;
    this.level = 0;
    this.trend = 0;
    this.residuals = [];
    this.variance = 0;
    this.recentErrors = [];
    this.errorWindow = config.errorWindow || 10;
  }

  addLedgerData(ledger) {
    if (!ledger) return;

    const entry = {
      timestamp: new Date(ledger.closed_at || ledger.closedAt || Date.now()).getTime(),
      ops: ledger.operation_count || ledger.ops || 0,
      txCount: ledger.successful_transaction_count || ledger.txCount || 0,
      failedCount: ledger.failed_transaction_count || ledger.failedCount || 0,
      sequence: ledger.sequence || 0,
    };

    const closeTime = ledger.close_time || ledger.closeTime || 5.0;
    entry.opsPerSecond = entry.ops / Math.max(1, closeTime);
    entry.tps = entry.txCount / Math.max(1, closeTime);
    entry.congestionRatio = Math.min(entry.ops / this.ledgerCapacity, 1.0);

    this.history.push(entry);

    if (this.history.length > 500) {
      this.history.shift();
    }

    this.fitted = false;
  }

  /**
   * Detect regime change and adjust smoothing parameters
   */
  adaptParameters(predictionError) {
    if (!this.adaptiveEnabled) return;
    
    this.recentErrors.push(Math.abs(predictionError));
    if (this.recentErrors.length > this.errorWindow) {
      this.recentErrors.shift();
    }
    
    if (this.recentErrors.length < 3) return;
    
    const recentMean = this.recentErrors.reduce((a, b) => a + b, 0) / this.recentErrors.length;
    const currentError = Math.abs(predictionError);
    
    if (recentMean > 0 && currentError > recentMean * this.regimeThreshold) {
      this.smoothingAlpha = Math.min(0.8, this.baseAlpha * 2.5);
      this.smoothingBeta = Math.min(0.5, this.baseBeta * 2.0);
    } else {
      this.smoothingAlpha = this.baseAlpha;
      this.smoothingBeta = this.baseBeta;
    }
  }

  /**
   * Fit the model using Adaptive Holt's Double Exponential Smoothing
   */
  fit() {
    if (this.history.length < this.minDataPoints) {
      return false;
    }

    const values = this.history.map(h => h.tps);
    const n = values.length;

    const windowSize = Math.min(5, Math.floor(n / 3));
    const sortedFirst = values.slice(0, windowSize).sort((a, b) => a - b);
    this.level = sortedFirst[Math.floor(sortedFirst.length / 2)];
    
    if (n >= 2) {
      const firstHalf = values.slice(0, Math.floor(n / 2));
      const secondHalf = values.slice(Math.floor(n / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      this.trend = (avgSecond - avgFirst) / Math.floor(n / 2);
    }

    this.residuals = [];
    this.recentErrors = [];
    let prevLevel = this.level;
    let prevTrend = this.trend;
    let alpha = this.baseAlpha;
    let beta = this.baseBeta;

    for (let i = 0; i < n; i++) {
      const prediction = prevLevel + prevTrend;
      const error = values[i] - prediction;
      
      this.residuals.push(error);
      
      if (this.adaptiveEnabled && i > 0) {
        this.recentErrors.push(Math.abs(error));
        if (this.recentErrors.length > this.errorWindow) {
          this.recentErrors.shift();
        }
        
        if (this.recentErrors.length >= 3) {
          const recentMean = this.recentErrors.reduce((a, b) => a + b, 0) / this.recentErrors.length;
          if (recentMean > 0 && Math.abs(error) > recentMean * this.regimeThreshold) {
            alpha = Math.min(0.8, this.baseAlpha * 2.5);
            beta = Math.min(0.5, this.baseBeta * 2.0);
          } else {
            alpha = this.baseAlpha;
            beta = this.baseBeta;
          }
        }
      }
      
      const level = alpha * values[i] + (1 - alpha) * (prevLevel + prevTrend);
      const trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      
      prevLevel = level;
      prevTrend = trend;
    }

    this.level = prevLevel;
    this.trend = prevTrend;
    this.smoothingAlpha = alpha;
    this.smoothingBeta = beta;

    if (n > 1) {
      const mean = this.residuals.reduce((a, b) => a + b, 0) / n;
      this.variance = this.residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
    } else {
      this.variance = 0;
    }

    this.fitted = true;
    return true;
  }

  /**
   * Generate forecast for next N periods
   */
  forecast(periodsAhead = 10) {
    if (!this.fitted) {
      if (!this.fit()) {
        return this.generateDefaultForecast(periodsAhead);
      }
    }

    const predictions = [];
    const lastTimestamp = this.history[this.history.length - 1]?.timestamp || Date.now();
    const avgInterval = this.calculateAverageInterval();
    const dampFactor = 0.95;

    for (let h = 1; h <= periodsAhead; h++) {
      const dampedTrend = this.trend * (1 - Math.pow(dampFactor, h)) / (1 - dampFactor);
      const predictedTps = this.level + dampedTrend;
      const predictedOps = predictedTps * this.getAverageCloseTime();

      const zScore = this.getZScore(this.confidenceLevel);
      const stdError = Math.sqrt(this.variance);
      const margin = zScore * stdError * Math.sqrt(h);

      predictions.push({
        horizon: h,
        timestamp: lastTimestamp + h * avgInterval,
        predictedTps: Math.max(0, predictedTps),
        predictedOps: Math.max(0, predictedOps),
        lowerBound: Math.max(0, predictedTps - margin),
        upperBound: Math.max(0, predictedTps + margin),
        congestionUtilization: Math.min(Math.max(0, predictedOps) / this.ledgerCapacity, 1.0),
      });
    }

    return {
      predictions,
      currentLevel: this.level,
      currentTrend: this.trend,
      trendDirection: this.trend > 0.1 ? 'increasing' : this.trend < -0.1 ? 'decreasing' : 'stable',
      volatility: Math.sqrt(this.variance),
      fitQuality: this.calculateRSquared(),
      dataPoints: this.history.length,
      forecastPeriods: periodsAhead,
    };
  }

  getAverageCloseTime() {
    if (this.history.length === 0) return 5.0;
    const recent = this.history.slice(-20);
    let total = 0;
    let count = 0;
    for (const entry of recent) {
      if (entry.timestamp && entry.sequence) {
        // Estimate close time from consecutive ledgers
        continue;
      }
      count++;
    }
    return 5.0;
  }

  /**
   * Predict capacity utilization for a given time horizon
   */
  forecastCapacityUtilization(hoursAhead = 1) {
    const periodsAhead = Math.ceil((hoursAhead * 3600) / 5.0);
    const result = this.forecast(periodsAhead);

    const currentUtilization = this.history.length > 0 
      ? this.history[this.history.length - 1].congestionRatio 
      : 0;

    const futureUtilizations = result.predictions.map(p => p.congestionUtilization);
    const maxUtilization = Math.max(...futureUtilizations);
    const avgUtilization = futureUtilizations.reduce((a, b) => a + b, 0) / futureUtilizations.length;

    return {
      currentUtilization,
      avgUtilization,
      maxUtilization,
      timeHorizonHours: hoursAhead,
      predictions: result.predictions,
      scalingScenario: maxUtilization > 0.8 ? 'capacity-constrained' : maxUtilization > 0.5 ? 'moderate-load' : 'normal',
    };
  }

  /**
   * Analyze scaling scenarios based on current trends
   */
  analyzeScalingScenario() {
    if (this.history.length < 20) {
      return {
        scenario: 'insufficient-data',
        recommendation: 'Need at least 20 data points for scaling analysis',
      };
    }

    const recentHistory = this.history.slice(-50);
    const recentUtilizations = recentHistory.map(h => h.congestionRatio);
    const avgUtilization = recentUtilizations.reduce((a, b) => a + b, 0) / recentUtilizations.length;
    const peakUtilization = Math.max(...recentUtilizations);

    const growthRate = this.trend / Math.max(0.001, this.level) * 100;

    let scenario = 'normal';
    let riskLevel = 'low';
    let recommendation = '';

    if (peakUtilization > 0.9) {
      scenario = 'critical';
      riskLevel = 'high';
      recommendation = 'Network operating near capacity. Consider protocol upgrades or capacity expansion.';
    } else if (avgUtilization > 0.7 || growthRate > 5) {
      scenario = 'approaching-capacity';
      riskLevel = 'medium';
      recommendation = 'Throughput trending upward. Monitor closely and prepare scaling solutions.';
    } else if (growthRate < -5) {
      scenario = 'declining';
      riskLevel = 'low';
      recommendation = 'Network activity declining. No immediate scaling action needed.';
    } else {
      scenario = 'normal';
      riskLevel = 'low';
      recommendation = 'Network operating within normal capacity bounds.';
    }

    return {
      scenario,
      riskLevel,
      recommendation,
      metrics: {
        avgUtilization,
        peakUtilization,
        growthRate,
        currentTps: this.level,
        trend: this.trend,
      },
    };
  }

  calculateAverageInterval() {
    if (this.history.length < 2) return 5000;
    let totalInterval = 0;
    for (let i = 1; i < this.history.length; i++) {
      totalInterval += this.history[i].timestamp - this.history[i - 1].timestamp;
    }
    return totalInterval / (this.history.length - 1);
  }

  getZScore(confidenceLevel) {
    const alpha = 1 - confidenceLevel;
    const p = 1 - alpha / 2;
    const a1 = -3.969683028665376e+01;
    const a2 = 2.209460984245205e+02;
    const a3 = -2.759285104469687e+02;
    const a4 = 1.383577518672690e+02;
    const a5 = -3.066479806614716e+01;
    const a6 = 2.506628277459239e+00;
    const b1 = -5.447609879822406e+01;
    const b2 = 1.615858368580409e+02;
    const b3 = -1.556989798598866e+02;
    const b4 = 6.680131188771972e+01;
    const b5 = -1.328068155288572e+01;
    const c1 = -7.784894002430293e-03;
    const c2 = -3.223964580411365e-01;
    const c3 = -2.400758277161838e+00;
    const c4 = -2.549732539343734e+00;
    const c5 = 4.374664141464968e+00;
    const c6 = 2.938163982698783e+00;
    const d1 = 7.784695709041462e-03;
    const d2 = 3.224671290700398e-01;
    const d3 = 2.445134137142996e+00;
    const d4 = 3.754408661907416e+00;
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
  }

  calculateRSquared() {
    if (this.history.length < 2) return 0;
    const values = this.history.map(h => h.tps);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const ssTotal = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    const ssResidual = this.residuals.reduce((sum, r) => sum + Math.pow(r, 2), 0);
    if (ssTotal === 0) return 1;
    return Math.max(0, 1 - ssResidual / ssTotal);
  }

  generateDefaultForecast(periodsAhead) {
    const lastEntry = this.history[this.history.length - 1];
    const avgTps = lastEntry ? lastEntry.tps : 0;
    const avgInterval = this.calculateAverageInterval();
    const lastTimestamp = lastEntry?.timestamp || Date.now();

    const predictions = [];
    for (let h = 1; h <= periodsAhead; h++) {
      predictions.push({
        horizon: h,
        timestamp: lastTimestamp + h * avgInterval,
        predictedTps: avgTps,
        predictedOps: avgTps * 5.0,
        lowerBound: avgTps * 0.7,
        upperBound: avgTps * 1.3,
        congestionUtilization: (avgTps * 5.0) / this.ledgerCapacity,
      });
    }

    return {
      predictions,
      currentLevel: avgTps,
      currentTrend: 0,
      trendDirection: 'unknown',
      volatility: 0,
      fitQuality: 0,
      dataPoints: this.history.length,
      forecastPeriods: periodsAhead,
    };
  }

  save() {
    return {
      level: this.level,
      trend: this.trend,
      variance: this.variance,
      residuals: this.residuals,
      recentErrors: this.recentErrors,
      baseAlpha: this.baseAlpha,
      baseBeta: this.baseBeta,
      history: this.history.slice(-200),
      config: {
        baseAlpha: this.baseAlpha,
        baseBeta: this.baseBeta,
        minDataPoints: this.minDataPoints,
        ledgerCapacity: this.ledgerCapacity,
        confidenceLevel: this.confidenceLevel,
        adaptiveEnabled: this.adaptiveEnabled,
        regimeThreshold: this.regimeThreshold,
        errorWindow: this.errorWindow,
      },
    };
  }

  static load(state) {
    const forecaster = new ThroughputForecaster(state.config);
    forecaster.level = state.level;
    forecaster.trend = state.trend;
    forecaster.variance = state.variance;
    forecaster.residuals = state.residuals || [];
    forecaster.recentErrors = state.recentErrors || [];
    forecaster.history = state.history || [];
    forecaster.fitted = forecaster.history.length >= forecaster.minDataPoints;
    return forecaster;
  }
}

export default ThroughputForecaster;
