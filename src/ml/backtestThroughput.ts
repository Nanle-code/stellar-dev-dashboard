/**
 * Backtesting script for ThroughputForecaster
 * 
 * Fetches historical ledger data from Stellar Horizon API,
 * trains the forecaster on a subset, and validates predictions
 * against held-out data to measure accuracy.
 * 
 * Usage: node src/ml/backtestThroughput.js [--network testnet] [--ledgers 200]
 */

import ThroughputForecaster from './throughputForecaster.js';
import { logger } from '../lib/logging';

const HORIZON_URLS = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

async function fetchLedgers(network, count) {
  const baseUrl = HORIZON_URLS[network] || HORIZON_URLS.testnet;
  const url = `${baseUrl}/ledgers?order=desc&limit=${Math.min(count, 200)}&cursor=`;
  
  logger.info(`Fetching ${count} ledgers from ${network}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Horizon API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const ledgers = data._embedded?.records || [];
  
  logger.info(`Fetched ${ledgers.length} ledgers`);
  return ledgers.map(l => ({
    sequence: l.sequence,
    operation_count: parseInt(l.operation_count || '0', 10),
    successful_transaction_count: parseInt(l.successful_transaction_count || '0', 10),
    failed_transaction_count: parseInt(l.failed_transaction_count || '0', 10),
    close_time: parseFloat(l.close_time || '5.0'),
    closed_at: l.closed_at,
  }));
}

function computeActualTps(ledger) {
  const closeTime = Math.max(1, parseFloat(ledger.close_time || '5.0'));
  return ledger.successful_transaction_count / closeTime;
}

function computeAccuracy(predicted, actual, tolerance) {
  if (actual === 0) return predicted === 0 ? 1 : Math.max(0, 1 - Math.abs(predicted) / tolerance);
  const error = Math.abs(predicted - actual) / Math.max(actual, 0.001);
  return Math.max(0, 1 - error);
}

async function backtest(network, totalLedgers, trainRatio = 0.7) {
  logger.info(`ThroughputForecaster Backtest — ${network}`);

  const ledgers = await fetchLedgers(network, totalLedgers);
  
  if (ledgers.length < 20) {
    logger.error('Insufficient ledger data for backtesting (need at least 20)');
    process.exit(1);
  }

  const sortedLedgers = ledgers.sort((a, b) => a.sequence - b.sequence);
  const trainSize = Math.floor(sortedLedgers.length * trainRatio);
  const trainData = sortedLedgers.slice(0, trainSize);
  const testData = sortedLedgers.slice(trainSize);

  logger.info(`Training set: ${trainData.length} ledgers (sequences ${trainData[0].sequence}–${trainData[trainData.length-1].sequence})`);
  logger.info(`Test set:     ${testData.length} ledgers (sequences ${testData[0].sequence}–${testData[testData.length-1].sequence})`);

  // Build forecaster from training data
  const forecaster = new ThroughputForecaster({
    smoothingAlpha: 0.3,
    smoothingBeta: 0.1,
    minDataPoints: 10,
  });

  for (const ledger of trainData) {
    forecaster.addLedgerData(ledger);
  }

  logger.info('Fitting model...');
  const fitted = forecaster.fit();
  if (!fitted) {
    logger.error('Failed to fit model');
    process.exit(1);
  }

  logger.info(`Model fitted: level=${forecaster.level.toFixed(2)}, trend=${forecaster.trend.toFixed(4)}, variance=${forecaster.variance.toFixed(4)}`);

  // Evaluate predictions against test data
  let totalAccuracy = 0;
  let within10pct = 0;
  let within20pct = 0;
  let within30pct = 0;
  let totalError = 0;
  const results = [];

  for (let i = 0; i < testData.length; i++) {
    const ledger = testData[i];
    const actualTps = computeActualTps(ledger);
    
    // Use forecast with horizon 1 (next ledger prediction)
    const forecast = forecaster.forecast(1);
    const predictedTps = forecast.predictions[0].predictedTps;
    
    const accuracy = computeAccuracy(predictedTps, actualTps, 10);
    const errorPct = actualTps > 0 ? Math.abs(predictedTps - actualTps) / actualTps * 100 : 0;
    
    totalAccuracy += accuracy;
    totalError += errorPct;
    
    if (errorPct <= 10) within10pct++;
    if (errorPct <= 20) within20pct++;
    if (errorPct <= 30) within30pct++;
    
    results.push({ sequence: ledger.sequence, actualTps, predictedTps, errorPct, accuracy });
    
    logger.debug(
      `Seq ${ledger.sequence}: actual=${actualTps.toFixed(2)}, predicted=${predictedTps.toFixed(2)}, error=${errorPct.toFixed(1)}%, acc=${(accuracy * 100).toFixed(1)}%`
    );

    // Update model with actual observation (online learning)
    forecaster.addLedgerData(ledger);
    forecaster.fit();
  }

  const avgAccuracy = totalAccuracy / testData.length;
  const avgError = totalError / testData.length;

  // Windowed evaluation (daily horizon: average over sliding windows)
  const windowSize = Math.max(5, Math.floor(results.length / 6));
  let windowAccuracy = 0;
  let windowCount = 0;
  
  for (let i = 0; i <= results.length - windowSize; i++) {
    const window = results.slice(i, i + windowSize);
    const avgActual = window.reduce((s, r) => s + r.actualTps, 0) / window.length;
    const avgPredicted = window.reduce((s, r) => s + r.predictedTps, 0) / window.length;
    if (!isFinite(avgActual) || !isFinite(avgPredicted)) continue;
    const windowAcc = computeAccuracy(avgPredicted, avgActual, 10);
    if (!isFinite(windowAcc)) continue;
    windowAccuracy += windowAcc;
    windowCount++;
  }
  const avgWindowAccuracy = windowCount > 0 ? windowAccuracy / windowCount : 0;

  const meetsTarget = avgWindowAccuracy >= 0.85 || avgAccuracy >= 0.85;
  logger.info('Backtest results', {
    testSamples: testData.length,
    averageAccuracy: `${(avgAccuracy * 100).toFixed(1)}%`,
    averageError: `${avgError.toFixed(1)}%`,
    within10pct: `${within10pct}/${testData.length}`,
    within20pct: `${within20pct}/${testData.length}`,
    within30pct: `${within30pct}/${testData.length}`,
    windowedAccuracy: `${(avgWindowAccuracy * 100).toFixed(1)}%`,
    meetsTarget,
  });
  
  // Capacity utilization test
  const capacity = forecaster.forecastCapacityUtilization(1);
  logger.info('Capacity utilization forecast', {
    currentUtilization: `${(capacity.currentUtilization * 100).toFixed(1)}%`,
    avgUtilization1h: `${(capacity.avgUtilization * 100).toFixed(1)}%`,
    maxUtilization1h: `${(capacity.maxUtilization * 100).toFixed(1)}%`,
    scalingScenario: capacity.scalingScenario,
  });

  // Scaling analysis
  const scaling = forecaster.analyzeScalingScenario();
  logger.info('Scaling analysis', {
    scenario: scaling.scenario,
    riskLevel: scaling.riskLevel,
    recommendation: scaling.recommendation,
  });

  return { avgAccuracy, avgError, meetsTarget, within10pct, within20pct, within30pct, avgWindowAccuracy };
}

// Parse CLI args
const args = process.argv.slice(2);
let network = 'testnet';
let ledgers = 200;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--network' && args[i + 1]) network = args[i + 1];
  if (args[i] === '--ledgers' && args[i + 1]) ledgers = parseInt(args[i + 1], 10);
}

backtest(network, ledgers).catch(err => {
  logger.error('Backtest failed: ' + err.message);
  process.exit(1);
});
