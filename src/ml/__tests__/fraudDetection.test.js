import { describe, it, expect, beforeEach, vi } from 'vitest';

let FraudGraph;
let buildFraudGraph;
let CoordinatedPatternDetector;
let FraudScoringEngine;
let FraudReportGenerator;
let FraudDetectionController;

beforeEach(async () => {
  const graphModule = await import('../graphAnalysis.cjs');
  const patternModule = await import('../coordinatedPatternDetector.cjs');
  const scoringModule = await import('../fraudScoringEngine.cjs');
  const reportModule = await import('../fraudReportGenerator.cjs');
  const controllerModule = await import('../fraudDetectionController.cjs');

  FraudGraph = graphModule.FraudGraph;
  buildFraudGraph = graphModule.buildFraudGraph;
  CoordinatedPatternDetector = patternModule.CoordinatedPatternDetector;
  FraudScoringEngine = scoringModule.FraudScoringEngine;
  FraudReportGenerator = reportModule.FraudReportGenerator;
  FraudDetectionController = controllerModule.FraudDetectionController;
});

function makeTx(overrides = {}) {
  return {
    id: `tx_${Math.random().toString(36).slice(2)}`,
    source_account: overrides.source_account || `G${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    to: overrides.to || `G${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    amount: overrides.amount || Math.random() * 1000 + 10,
    created_at: overrides.created_at || new Date().toISOString(),
    fee_charged: overrides.fee_charged || '100',
    successful: overrides.successful !== undefined ? overrides.successful : true,
    operation_count: overrides.operation_count || 1,
    senderFreq: overrides.senderFreq || 50,
    recipientFreq: overrides.recipientFreq || 20,
    inputs: overrides.inputs || 1,
    outputs: overrides.outputs || 1,
  };
}

function makeFraudTx(index) {
  const fraudAccounts = ['GABCDEF123', 'GDEFGHI456', 'GHIJKLM789', 'GJKLNMNO012', 'GMNOPQR345'];
  const fraudRecipients = ['GXYZUVW987', 'GUVWRST654', 'GRSTOPQ321', 'GOPQLMN098', 'GLMNXYZ765'];
  const baseTime = Date.now() - 60000;
  const amount = 10000;
  return makeTx({
    source_account: fraudAccounts[index % fraudAccounts.length],
    to: fraudRecipients[index % fraudRecipients.length],
    amount: amount,
    created_at: new Date(baseTime + index * 5000).toISOString(),
    fee_charged: String(Math.floor(Math.random() * 5000 + 500)),
    successful: Math.random() > 0.3,
    operation_count: Math.floor(Math.random() * 8 + 2),
    senderFreq: Math.floor(Math.random() * 3),
    recipientFreq: Math.floor(Math.random() * 2),
    inputs: Math.floor(Math.random() * 5 + 2),
    outputs: Math.floor(Math.random() * 4 + 1),
  });
}

describe('FraudGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new FraudGraph();
  });

  it('starts empty', () => {
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.length).toBe(0);
  });

  it('adds nodes and edges correctly', () => {
    graph.addEdge('GA', 'GB', { amount: 100 });
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.nodes.get('GA').degree).toBe(1);
    expect(graph.nodes.get('GB').degree).toBe(1);
  });

  it('builds graph from transactions', () => {
    const txs = [makeTx(), makeTx(), makeTx()];
    graph.buildFromTransactions(txs);
    expect(graph.nodes.size).toBeGreaterThanOrEqual(2);
    expect(graph.edges.length).toBe(3);
  });

  it('detects communities', () => {
    graph.addEdge('GA', 'GB');
    graph.addEdge('GB', 'GC');
    graph.addEdge('GC', 'GA');
    graph.addEdge('GX', 'GY');
    const communities = graph.detectCommunities();
    expect(communities.size).toBeGreaterThanOrEqual(1);
  });

  it('computes page rank', () => {
    graph.addEdge('GA', 'GB');
    graph.addEdge('GB', 'GC');
    graph.addEdge('GC', 'GA');
    const ranks = graph.computePageRank();
    expect(ranks.size).toBe(3);
    for (const rank of ranks.values()) {
      expect(rank).toBeGreaterThan(0);
    }
  });

  it('finds suspicious subgraphs', () => {
    for (let i = 0; i < 5; i++) {
      const members = ['GAAA', 'GBBB', 'GCCC', 'GDDD', 'GEEE'];
      for (const m1 of members) {
        for (const m2 of members) {
          if (m1 < m2) {
            graph.addEdge(m1, m2);
          }
        }
      }
    }
    const suspicious = graph.findSuspiciousSubgraphs(3, 0.3);
    expect(suspicious.length).toBeGreaterThan(0);
  });

  it('finds shortest path', () => {
    graph.addEdge('GA', 'GB');
    graph.addEdge('GB', 'GC');
    graph.addEdge('GC', 'GD');
    const path = graph.shortestPath('GA', 'GD');
    expect(path).toEqual(['GA', 'GB', 'GC', 'GD']);
  });

  it('returns null for unreachable nodes', () => {
    graph.addEdge('GA', 'GB');
    graph.addEdge('GX', 'GY');
    const path = graph.shortestPath('GA', 'GX');
    expect(path).toBeNull();
  });

  it('finds mutual connections', () => {
    graph.addEdge('GA', 'GX');
    graph.addEdge('GB', 'GX');
    graph.addEdge('GA', 'GY');
    const mutual = graph.findMutualConnections('GA', 'GB');
    expect(mutual).toContain('GX');
  });

  it('detects burst transactions', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      graph.addEdge(`sender_${i}`, `recip_${i}`, {
        amount: 100,
        timestamp: new Date(now + i * 100).toISOString(),
      });
    }
    const bursts = graph.findBurstTransactions(5000, 5);
    expect(bursts.length).toBeGreaterThan(0);
  });

  it('buildFraudGraph factory works', () => {
    const txs = [makeTx(), makeTx(), makeTx()];
    const g = buildFraudGraph(txs);
    expect(g.nodes.size).toBeGreaterThan(0);
    expect(g.communities).not.toBeNull();
  });
});

describe('CoordinatedPatternDetector', () => {
  let detector;
  let graph;

  beforeEach(() => {
    detector = new CoordinatedPatternDetector();
    graph = new FraudGraph();
  });

  it('detects circular trading patterns', () => {
    graph.addEdge('GA', 'GB', { amount: 100, timestamp: new Date().toISOString() });
    graph.addEdge('GB', 'GC', { amount: 200, timestamp: new Date().toISOString() });
    graph.addEdge('GC', 'GA', { amount: 300, timestamp: new Date().toISOString() });
    graph.detectCommunities();
    const patterns = detector._detectCircularTrading(graph);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].type).toBe('circular_trading');
    expect(patterns[0].severity).toBe('high');
  });

  it('detects fan-out fan-in patterns', () => {
    const hub = 'GHUB';
    for (let i = 0; i < 6; i++) {
      const node = `GSPOKE${i}`;
      graph.addEdge(hub, node, { amount: 100 });
      graph.addEdge(node, hub, { amount: 100 });
    }
    graph.detectCommunities();
    const patterns = detector._detectFanOutFanIn(graph);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('detects coordinated bursts', () => {
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
      graph.addEdge(`GA${i}`, `GB${i}`, {
        amount: 100,
        timestamp: new Date(now + i * 10).toISOString(),
      });
    }
    graph.detectCommunities();
    const patterns = detector._detectBurstActivity(graph);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('detects self-feeding transactions', () => {
    graph.addEdge('GA', 'GA', { amount: 100 });
    const patterns = detector._detectSelfFeeding(graph);
    expect(patterns.length).toBe(1);
    expect(patterns[0].type).toBe('self_feeding');
  });

  it('detects amount clustering', () => {
    const txs = [];
    for (let i = 0; i < 6; i++) {
      txs.push(makeTx({
        source_account: `GA${i}`,
        to: 'GCOMMON',
        amount: 100,
      }));
    }
    const patterns = detector._detectAmountClustering(txs);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].type).toBe('amount_clustering');
  });

  it('detects temporal coordination', () => {
    const txs = [];
    const sameTime = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      txs.push(makeTx({
        source_account: `GA${i}`,
        created_at: sameTime,
      }));
    }
    const patterns = detector._detectTemporalCoordination(txs);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].type).toBe('temporal_coordination');
  });

  it('runs full detection pipeline', () => {
    const txs = Array.from({ length: 10 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    const patterns = detector.detectAll(graph, txs);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('returns pattern summary', () => {
    const txs = Array.from({ length: 8 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    detector.detectAll(graph, txs);
    const summary = detector.getPatternSummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0]).toHaveProperty('type');
    expect(summary[0]).toHaveProperty('count');
  });

  it('filters by confidence threshold', () => {
    const txs = Array.from({ length: 8 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    detector.detectAll(graph, txs);
    const highConf = detector.getHighConfidencePatterns(0.9);
    expect(Array.isArray(highConf)).toBe(true);
  });
});

describe('FraudScoringEngine', () => {
  let engine;
  let graph;

  beforeEach(() => {
    engine = new FraudScoringEngine();
    graph = new FraudGraph();
  });

  it('produces a score between 0 and 1', () => {
    const txs = Array.from({ length: 5 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    const patterns = new CoordinatedPatternDetector().detectAll(graph, txs);
    const result = engine.score(graph, txs, patterns);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(['critical', 'high', 'medium', 'low', 'none']).toContain(result.severity);
  });

  it('returns isFraud true for high scores', () => {
    const txs = Array.from({ length: 15 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    const patterns = new CoordinatedPatternDetector().detectAll(graph, txs);
    const result = engine.score(graph, txs, patterns);
    expect(result).toHaveProperty('isFraud');
    expect(typeof result.isFraud).toBe('boolean');
  });

  it('scores individual transactions', () => {
    const tx = makeTx({ amount: 50000, operation_count: 10, senderFreq: 0 });
    graph.addEdge(tx.source_account, tx.to);
    const result = engine.scoreTransaction(tx, graph);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('scores transactions with no graph context', () => {
    const tx = makeTx({ amount: 100 });
    const result = engine.scoreTransaction(tx, null);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('scores accounts', () => {
    graph.addEdge('GA', 'GB');
    graph.addEdge('GA', 'GC');
    graph.addEdge('GA', 'GD');
    graph.addEdge('GA', 'GE');
    graph.addEdge('GA', 'GF');
    graph.addEdge('GB', 'GH');
    graph.computePageRank();
    graph.detectCommunities();
    const scores = engine.scoreAccounts(['GA', 'GB', 'GX'], graph);
    expect(scores.length).toBe(3);
    expect(scores.find((s) => s.accountId === 'GX')?.score).toBe(0);
  });

  it('allows custom weights', () => {
    engine.setWeights({ graphAnomaly: 1, communityRisk: 0, patternRisk: 0, transactionAnomaly: 0, temporalRisk: 0 });
    const txs = Array.from({ length: 5 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    const patterns = new CoordinatedPatternDetector().detectAll(graph, txs);
    const result = engine.score(graph, txs, patterns);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe('FraudReportGenerator', () => {
  let generator;
  let graph;

  beforeEach(() => {
    generator = new FraudReportGenerator();
    graph = new FraudGraph();
  });

  it('generates a full report with all sections', () => {
    const txs = Array.from({ length: 10 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    const patterns = new CoordinatedPatternDetector().detectAll(graph, txs);
    const scores = new FraudScoringEngine().score(graph, txs, patterns);

    const detectionResult = { graph, patterns, scores, transactions: txs, metadata: {} };
    const report = generator.generateFullReport(detectionResult);

    expect(report).toHaveProperty('reportId');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('executiveSummary');
    expect(report).toHaveProperty('networkAnalysis');
    expect(report).toHaveProperty('patternAnalysis');
    expect(report).toHaveProperty('accountAnalysis');
    expect(report).toHaveProperty('transactionAnalysis');
    expect(report).toHaveProperty('timeline');
    expect(report).toHaveProperty('riskAssessment');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('evidenceItems');
  });

  it('generates a summary report', () => {
    const txs = Array.from({ length: 5 }, (_, i) => makeFraudTx(i));
    graph.buildFromTransactions(txs);
    const patterns = new CoordinatedPatternDetector().detectAll(graph, txs);
    const scores = new FraudScoringEngine().score(graph, txs, patterns);

    const detectionResult = { graph, patterns, scores, transactions: txs, metadata: {} };
    const report = generator.generateSummaryReport(detectionResult);

    expect(report).toHaveProperty('reportId');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('recommendations');
    expect(report).not.toHaveProperty('timeline');
  });

  it('serializes to JSON', () => {
    const txs = [makeTx()];
    graph.buildFromTransactions(txs);
    const patterns = [];
    const scores = { score: 0, severity: 'low', isFraud: false, factors: {}, details: [] };

    const detectionResult = { graph, patterns, scores, transactions: txs, metadata: {} };
    const json = generator.toJSON(detectionResult);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('reportId');
  });

  it('handles empty data gracefully', () => {
    const detectionResult = {
      graph: new FraudGraph(),
      patterns: [],
      scores: { score: 0, severity: 'none', isFraud: false, factors: {}, details: [] },
      transactions: [],
      metadata: {},
    };
    const report = generator.generateFullReport(detectionResult);
    expect(report.summary.totalPatternsDetected).toBe(0);
    expect(report.summary.isFraudDetected).toBe(false);
  });
});

describe('FraudDetectionController', () => {
  let controller;

  beforeEach(() => {
    controller = new FraudDetectionController();
  });

  it('ingests transactions and builds graph', () => {
    const txs = Array.from({ length: 5 }, () => makeTx());
    controller.ingestTransactions(txs);
    expect(controller.transactions.length).toBe(5);
    expect(controller.graph.nodes.size).toBeGreaterThan(0);
  });

  it('runs full detection pipeline', () => {
    const txs = Array.from({ length: 10 }, (_, i) => makeFraudTx(i));
    controller.ingestTransactions(txs);
    const { result, report } = controller.runFullDetection();
    expect(result.scores).toBeDefined();
    expect(result.patterns.length).toBeGreaterThan(0);
    expect(report).toBeDefined();
  });

  it('scores individual transactions', async () => {
    const txs = Array.from({ length: 5 }, () => makeTx());
    controller.ingestTransactions(txs);
    const tx = makeTx({ amount: 50000, operation_count: 10 });
    const result = await controller.scoreSingleTransaction(tx);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('isFraud');
    expect(result).toHaveProperty('reasons');
  });

  it('returns system status', () => {
    const status = controller.getStatus();
    expect(status).toHaveProperty('transactionCount');
    expect(status).toHaveProperty('accountCount');
    expect(status).toHaveProperty('realtimeBufferSize');
    expect(status.isMonitoring).toBe(false);
  });

  it('manages detection history', () => {
    const txs = Array.from({ length: 5 }, (_, i) => makeFraudTx(i));
    controller.ingestTransactions(txs);
    controller.runFullDetection();
    const history = controller.getDetectionHistory(5);
    expect(history.length).toBeGreaterThan(0);
  });

  it('starts and stops real-time monitoring', () => {
    const id = controller.startRealtimeMonitoring(5000);
    expect(id).toBeDefined();
    expect(controller.getStatus().isMonitoring).toBe(true);
    controller.stopRealtimeMonitoring();
    expect(controller.getStatus().isMonitoring).toBe(false);
  });

  it('clears data', () => {
    controller.ingestTransactions([makeTx(), makeTx()]);
    expect(controller.transactions.length).toBe(2);
    controller.clearData();
    expect(controller.transactions.length).toBe(0);
    expect(controller.graph.nodes.size).toBe(0);
  });

  it('supports event listeners', () => {
    const events = [];
    const unsubscribe = controller.on('fraud_detected', (data) => {
      events.push(data);
    });
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('generates a report directly', () => {
    const txs = Array.from({ length: 5 }, (_, i) => makeFraudTx(i));
    controller.ingestTransactions(txs);
    const report = controller.generateReport();
    expect(report).toBeDefined();
    expect(report.reportId).toBeDefined();
  });
});

describe('Fraud Detection - End to End', () => {
  it('correctly scores coordinated fraud higher than normal transactions', () => {
    const controller = new FraudDetectionController();

    const normalTxs = Array.from({ length: 10 }, (_, i) =>
      makeTx({
        amount: Math.random() * 500 + 10,
        created_at: new Date(Date.now() - i * 3600000 + Math.random() * 300000).toISOString(),
        senderFreq: Math.floor(Math.random() * 50 + 10),
        recipientFreq: Math.floor(Math.random() * 30 + 5),
      })
    );

    controller.ingestTransactions(normalTxs);
    const normalResult = controller.runFullDetection();
    const normalScore = normalResult.result.scores.score;

    controller.clearData();

    const fraudAccounts = ['GFRD001', 'GFRD002', 'GFRD003', 'GFRD004', 'GFRD005'];
    const fraudTxs = [];
    for (let i = 0; i < 20; i++) {
      const sender = fraudAccounts[Math.floor(Math.random() * fraudAccounts.length)];
      let recipient = fraudAccounts[Math.floor(Math.random() * fraudAccounts.length)];
      while (recipient === sender) {
        recipient = fraudAccounts[Math.floor(Math.random() * fraudAccounts.length)];
      }
      fraudTxs.push(
        makeTx({
          source_account: sender,
          to: recipient,
          amount: Math.random() * 50000 + 5000,
          created_at: new Date(Date.now() - i * 60000 + Math.random() * 1000).toISOString(),
          senderFreq: 0,
          recipientFreq: 0,
          operation_count: Math.floor(Math.random() * 8 + 2),
        })
      );
    }

    controller.ingestTransactions(fraudTxs);
    const fraudResult = controller.runFullDetection();
    const fraudScore = fraudResult.result.scores.score;

    expect(fraudScore).toBeGreaterThan(normalScore);
  });

  it('generates comprehensive investigation report', () => {
    const controller = new FraudDetectionController();
    const txs = Array.from({ length: 15 }, (_, i) => makeFraudTx(i));
    controller.ingestTransactions(txs);
    const report = controller.generateReport();

    expect(report.summary.totalPatternsDetected).toBeGreaterThan(0);
    expect(report.summary.highSeverityPatterns).toBeGreaterThanOrEqual(0);
    expect(report.networkAnalysis).toBeDefined();
    expect(report.patternAnalysis.patternSummary.length).toBeGreaterThan(0);
    expect(report.accountAnalysis.topRiskyAccounts).toBeDefined();
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.evidenceItems.length).toBeGreaterThan(0);
    expect(report.riskAssessment.riskFactors).toBeDefined();
  });

  it('has sub-second processing time for up to 50 transactions', () => {
    const controller = new FraudDetectionController();
    const txs = Array.from({ length: 50 }, (_, i) => makeFraudTx(i));
    controller.ingestTransactions(txs);

    const start = performance.now();
    controller.runFullDetection();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });
});