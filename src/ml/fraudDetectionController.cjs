const { FraudGraph, buildFraudGraph } = require('./graphAnalysis.cjs');
const { CoordinatedPatternDetector } = require('./coordinatedPatternDetector.cjs');
const { FraudScoringEngine } = require('./fraudScoringEngine.cjs');
const { FraudReportGenerator } = require('./fraudReportGenerator.cjs');
const { scoreTransaction } = require('./scoringEngine.cjs');

class FraudDetectionController {
  constructor(options = {}) {
    this.graph = new FraudGraph();
    this.patternDetector = new CoordinatedPatternDetector();
    this.scoringEngine = new FraudScoringEngine();
    this.reportGenerator = new FraudReportGenerator();
    this.transactions = [];
    this.detectionHistory = [];
    this.realtimeBuffer = [];
    this.options = {
      realtimeWindowMs: options.realtimeWindowMs || 60000,
      detectionIntervalMs: options.detectionIntervalMs || 30000,
      maxHistorySize: options.maxHistorySize || 100,
      confidenceThreshold: options.confidenceThreshold || 0.6,
    };
    this._intervalId = null;
    this._listeners = new Map();
  }

  ingestTransactions(transactions) {
    if (!Array.isArray(transactions)) {
      transactions = [transactions];
    }

    for (const tx of transactions) {
      this.transactions.push(tx);
      this.realtimeBuffer.push(tx);
    }

    this.graph.buildFromTransactions(transactions);
    this.graph.detectCommunities();
    this.graph.computePageRank();
  }

  runFullDetection() {
    const startTime = Date.now();

    this.graph.detectCommunities();
    this.graph.computePageRank();

    const patterns = this.patternDetector.detectAll(this.graph, this.transactions);
    const scores = this.scoringEngine.score(this.graph, this.transactions, patterns);
    const result = {
      graph: this.graph,
      patterns,
      scores,
      transactions: this.transactions,
      metadata: {
        detectionTime: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        transactionCount: this.transactions.length,
        accountCount: this.graph.nodes.size,
      },
    };

    const report = this.reportGenerator.generateFullReport(result);

    this.detectionHistory.push({
      timestamp: new Date().toISOString(),
      scores,
      patternsSummary: this.patternDetector.getPatternSummary(),
    });

    if (this.detectionHistory.length > this.options.maxHistorySize) {
      this.detectionHistory.shift();
    }

    return { result, report };
  }

  runRealtimeDetection() {
    if (this.realtimeBuffer.length === 0) return null;

    const startTime = Date.now();
    const buffer = [...this.realtimeBuffer];
    this.realtimeBuffer = [];

    const graph = new FraudGraph();
    graph.buildFromTransactions(buffer);
    graph.detectCommunities();
    graph.computePageRank();

    const patterns = this.patternDetector.detectAll(graph, buffer);
    const scores = this.scoringEngine.score(graph, buffer, patterns);

    const detection = {
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      bufferSize: buffer.length,
      patterns,
      scores,
      highSeverityCount: patterns.filter((p) => p.severity === 'high').length,
    };

    if (detection.scores.isFraud) {
      this._emit('fraud_detected', detection);
    }

    if (detection.highSeverityCount > 0) {
      this._emit('patterns_detected', detection);
    }

    this._emit('detection_complete', detection);

    return detection;
  }

  startRealtimeMonitoring(intervalMs = null) {
    const interval = intervalMs || this.options.detectionIntervalMs;

    if (this._intervalId) {
      clearInterval(this._intervalId);
    }

    this._intervalId = setInterval(() => {
      this.runRealtimeDetection();
    }, interval);

    return this._intervalId;
  }

  stopRealtimeMonitoring() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in fraud detection listener for ${event}:`, err);
        }
      }
    }
  }

  async scoreSingleTransaction(tx) {
    const existingResult = await scoreTransaction(tx).catch(() => null);

    let graphContext = null;
    const accountId = tx.source_account || tx.from;
    if (this.graph.nodes.has(accountId)) {
      graphContext = this.graph;
    }

    const engineResult = this.scoringEngine.scoreTransaction(tx, graphContext);

    const combinedScore = existingResult
      ? Math.max(existingResult.score, engineResult.score)
      : engineResult.score;

    return {
      score: combinedScore,
      isFraud: combinedScore > 0.6,
      engineScore: engineResult,
      mlScore: existingResult,
      reasons: engineResult.reasons,
    };
  }

  getStatus() {
    return {
      isMonitoring: this._intervalId !== null,
      transactionCount: this.transactions.length,
      accountCount: this.graph.nodes.size,
      realtimeBufferSize: this.realtimeBuffer.length,
      detectionHistorySize: this.detectionHistory.length,
      lastDetection: this.detectionHistory[this.detectionHistory.length - 1] || null,
    };
  }

  getDetectionHistory(limit = 10) {
    return this.detectionHistory.slice(-limit);
  }

  clearData() {
    this.graph = new FraudGraph();
    this.transactions = [];
    this.realtimeBuffer = [];
    this.patternDetector = new CoordinatedPatternDetector();
  }

  generateReport() {
    const result = this.runFullDetection();
    return result.report;
  }
}

function createController(options = {}) {
  return new FraudDetectionController(options);
}

module.exports = { FraudDetectionController, createController };
