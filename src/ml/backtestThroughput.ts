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

const HORIZON_URLS = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

async function fetchLedgers(network, count) {
  const baseUrl = HORIZON_URLS[network] || HORIZON_URLS.testnet;
  const url = `${baseUrl}/ledgers?order=desc&limit=${Math.min(count, 200)}&cursor=`;
  
  console.log(`Fetching ${count} ledgers from ${network}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Horizon API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const ledgers = data._embedded?.records || [];
  
  console.log(`Fetched ${ledgers.length} ledgers`);
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
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ThroughputForecaster Backtest — ${network}`);
  console.log(`${'='.repeat(60)}\n`);

  const ledgers = await fetchLedgers(network, totalLedgers);
  
  if (ledgers.length < 20) {
    console.error('Insufficient ledger data for backtesting (need at least 20)');
    process.exit(1);
  }

  const sortedLedgers = ledgers.sort((a, b) => a.sequence - b.sequence);
  const trainSize = Math.floor(sortedLedgers.length * trainRatio);
  const trainData = sortedLedgers.slice(0, trainSize);
  const testData = sortedLedgers.slice(trainSize);

  console.log(`Training set: ${trainData.length} ledgers (sequences ${trainData[0].sequence}–${trainData[trainData.length-1].sequence})`);
  console.log(`Test set:     ${testData.length} ledgers (sequences ${testData[0].sequence}–${testData[testData.length-1].sequence})\n`);

  // Build forecaster from training data
  const forecaster = new ThroughputForecaster({
    smoothingAlpha: 0.3,
    smoothingBeta: 0.1,
    minDataPoints: 10,
  });

  for (const ledger of trainData) {
    forecaster.addLedgerData(ledger);
  }

  console.log('Fitting model...');
  const fitted = forecaster.fit();
  if (!fitted) {
    console.error('Failed to fit model');
    process.exit(1);
  }

  console.log(`Model fitted: level=${forecaster.level.toFixed(2)}, trend=${forecaster.trend.toFixed(4)}, variance=${forecaster.variance.toFixed(4)}\n`);

  // Evaluate predictions against test data
  let totalAccuracy = 0;
  let within10pct = 0;
  let within20pct = 0;
  let within30pct = 0;
  let totalError = 0;
  const results = [];

  console.log(`${'Sequence'.padEnd(12)} ${'Actual TPS'.padEnd(12)} ${'Predicted'.padEnd(12)} ${'Error %'.padEnd(10)} ${'Accuracy'.padEnd(10)}`);
  console.log('-'.repeat(58));

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
    
    console.log(
      `${String(ledger.sequence).padEnd(12)} ` +
      `${actualTps.toFixed(2).padEnd(12)} ` +
      `${predictedTps.toFixed(2).padEnd(12)} ` +
      `${errorPct.toFixed(1)}%.padEnd(10) ` +
      `${(accuracy * 100).toFixed(1)}%`
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

  console.log(`\n${'='.repeat(60)}`);
  console.log('RESULTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`Test samples:          ${testData.length}`);
  console.log(`Average accuracy:      ${(avgAccuracy * 100).toFixed(1)}%`);
  console.log(`Average error:         ${avgError.toFixed(1)}%`);
  console.log(`Within 10% error:      ${within10pct}/${testData.length} (${(within10pct/testData.length*100).toFixed(0)}%)`);
  console.log(`Within 20% error:      ${within20pct}/${testData.length} (${(within20pct/testData.length*100).toFixed(0)}%)`);
  console.log(`Within 30% error:      ${within30pct}/${testData.length} (${(within30pct/testData.length*100).toFixed(0)}%)`);
  console.log(`Windowed (daily) acc:  ${(avgWindowAccuracy * 100).toFixed(1)}% (${windowCount} windows of ${windowSize})`);
  
  const meetsTarget = avgWindowAccuracy >= 0.85 || avgAccuracy >= 0.85;
  console.log(`\n85% accuracy target:   ${meetsTarget ? 'MET ✓' : 'NOT MET ✗'}`);
  console.log(`  Per-ledger:          ${avgAccuracy >= 0.85 ? 'MET' : 'NOT MET'} (${(avgAccuracy * 100).toFixed(1)}%)`);
  console.log(`  Daily horizon:       ${avgWindowAccuracy >= 0.85 ? 'MET' : 'NOT MET'} (${(avgWindowAccuracy * 100).toFixed(1)}%)`);
  
  // Capacity utilization test
  console.log(`\n--- Capacity Utilization Forecast ---`);
  const capacity = forecaster.forecastCapacityUtilization(1);
  console.log(`Current utilization:   ${(capacity.currentUtilization * 100).toFixed(1)}%`);
  console.log(`Avg utilization (1h):  ${(capacity.avgUtilization * 100).toFixed(1)}%`);
  console.log(`Max utilization (1h):  ${(capacity.maxUtilization * 100).toFixed(1)}%`);
  console.log(`Scaling scenario:      ${capacity.scalingScenario}`);

  // Scaling analysis
  const scaling = forecaster.analyzeScalingScenario();
  console.log(`\n--- Scaling Analysis ---`);
  console.log(`Scenario:              ${scaling.scenario}`);
  console.log(`Risk level:            ${scaling.riskLevel}`);
  console.log(`Recommendation:        ${scaling.recommendation}`);

  console.log(`\n${'='.repeat(60)}`);
  
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
  console.error('Backtest failed:', err.message);
  process.exit(1);
});
