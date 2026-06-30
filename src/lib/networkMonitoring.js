/**
 * Telemetry and network monitoring service for Stellar.
 * Processes Horizon network state, fee distributions, and ledger closed-intervals
 * to compute advanced diagnostics, congestion load, fee predictions, and validator performance.
 */

// Curated list of prominent Stellar validators with base configuration
export const PRIMARY_VALIDATORS = [
  { id: '1', name: 'SDF Validator 1', operator: 'Stellar Development Foundation', country: 'US', region: 'Iowa', basePing: 34, votingPower: 4.8 },
  { id: '2', name: 'SDF Validator 2', operator: 'Stellar Development Foundation', country: 'SG', region: 'Singapore', basePing: 82, votingPower: 4.8 },
  { id: '3', name: 'SDF Validator 3', operator: 'Stellar Development Foundation', country: 'DE', region: 'Frankfurt', basePing: 45, votingPower: 4.8 },
  { id: '4', name: 'LOBSTR Node', operator: 'Ultra Stellar', country: 'FI', region: 'Helsinki', basePing: 52, votingPower: 3.5 },
  { id: '5', name: 'SatoshiPay Node 1', operator: 'SatoshiPay', country: 'DE', region: 'Berlin', basePing: 42, votingPower: 3.2 },
  { id: '6', name: 'Coinqvest Validator', operator: 'Coinqvest', country: 'NL', region: 'Amsterdam', basePing: 48, votingPower: 2.9 },
  { id: '7', name: 'Stellarport Node', operator: 'Stellarport', country: 'US', region: 'Virginia', basePing: 28, votingPower: 2.5 },
  { id: '8', name: 'PublicNode SDF', operator: 'PublicNode', country: 'US', region: 'Oregon', basePing: 61, votingPower: 3.1 }
];

// Protocol and ledger capacity constants
export const LEDGER_OPERATION_LIMIT = 1000; // Capacity limit constant for congestion calculation
export const LEDGER_BASE_RESERVE_STROOPS = 5000000; // 0.5 XLM

/**
 * Calculates network congestion metrics from the latest ledger information
 * @param {object} latestLedger - Horizon ledger record
 * @returns {object} Congestion index details
 */
export function calculateCongestion(latestLedger) {
  if (!latestLedger) return { ratio: 0, level: 'LOW', color: 'var(--green)' };

  const ops = latestLedger.operation_count || 0;
  const ratio = Math.min(ops / LEDGER_OPERATION_LIMIT, 1);

  let level = 'LOW';
  let color = 'var(--green)';

  if (ratio >= 0.8) {
    level = 'CRITICAL';
    color = 'var(--red)';
  } else if (ratio >= 0.5) {
    level = 'HIGH';
    color = 'var(--amber)';
  } else if (ratio >= 0.2) {
    level = 'MODERATE';
    color = 'var(--cyan)';
  }

  // Calculate transaction success rate
  const successTx = latestLedger.successful_transaction_count || 0;
  const failedTx = latestLedger.failed_transaction_count || 0;
  const totalTx = successTx + failedTx;
  const successRate = totalTx > 0 ? (successTx / totalTx) * 100 : 100;

  return {
    ratio,
    percentage: Math.round(ratio * 100),
    level,
    color,
    successRate: parseFloat(successRate.toFixed(2)),
    opsCount: ops,
    txCount: totalTx
  };
}

/**
 * Generates interactive live validator statuses with simulated real-time jitter/pings
 * @returns {Array} Validator status array
 */
export function getLiveValidatorStatus() {
  return PRIMARY_VALIDATORS.map(v => {
    // Simulate real-time network fluctuations (ping base +/- 15%)
    const jitter = (Math.random() - 0.5) * 2 * (v.basePing * 0.15);
    const currentPing = Math.max(10, Math.round(v.basePing + jitter));
    
    // 98% uptime simulation
    const isOnline = Math.random() > 0.02;
    const status = isOnline ? 'ONLINE' : 'OFFLINE';

    // Simulate minor sync states (e.g. v21 protocol consensus)
    const protocolVersion = 'v21.0.0';
    const activeConsensus = isOnline ? (Math.random() > 0.05 ? 100 : 99.2) : 0;

    return {
      ...v,
      ping: isOnline ? currentPing : null,
      status,
      protocolVersion,
      consensus: parseFloat(activeConsensus.toFixed(2))
    };
  });
}

/**
 * Computes fee predictions for varying urgency levels based on Horizon feeStats and congestion
 * @param {object} feeStats - Horizon feeStats response
 * @param {number} congestionRatio - Calculated congestion occupancy ratio
 * @returns {object} Recommended priority fees
 */
export function predictFees(feeStats, congestionRatio = 0.1) {
  if (!feeStats) {
    return {
      low: { stroops: 100, xlm: '0.0000100', expectedInclusion: '3 ledgers' },
      standard: { stroops: 150, xlm: '0.0000150', expectedInclusion: '1-2 ledgers' },
      high: { stroops: 300, xlm: '0.0000300', expectedInclusion: 'next ledger' }
    };
  }

  // Baseline from Horizon feeStats
  const baseFee = parseInt(feeStats.last_ledger_base_fee || 100);
  const min = parseInt(feeStats.min_accepted_fee || baseFee);
  const median = parseInt(feeStats.median_accepted_fee || baseFee * 1.5);
  const p90 = parseInt(feeStats.p90_accepted_fee || baseFee * 3);

  // Apply congestion multiplier (up to 2.5x base fee recommendations under critical load)
  const multiplier = 1 + (congestionRatio * 1.5);

  const lowStroops = Math.max(min, Math.round(baseFee * multiplier));
  const stdStroops = Math.max(lowStroops + 10, Math.round(median * multiplier));
  const highStroops = Math.max(stdStroops + 50, Math.round(p90 * multiplier));

  const toXLM = (stroops) => (stroops / 10000000).toFixed(7);

  return {
    low: {
      stroops: lowStroops,
      xlm: toXLM(lowStroops),
      expectedInclusion: congestionRatio > 0.8 ? '~3-4 ledgers' : '~3 ledgers'
    },
    standard: {
      stroops: stdStroops,
      xlm: toXLM(stdStroops),
      expectedInclusion: congestionRatio > 0.8 ? '2-3 ledgers' : '1-2 ledgers'
    },
    high: {
      stroops: highStroops,
      xlm: toXLM(highStroops),
      expectedInclusion: 'next ledger'
    }
  };
}

/**
 * Calculates current network-wide TPS and OPS averages
 * @param {object} ledger - Current Horizon ledger
 * @param {number} closeTime - Time took to close this ledger in seconds
 * @returns {object} Computed metrics
 */
export function calculatePerformanceMetrics(ledger, closeTime = 5.0) {
  if (!ledger) return { tps: 0, ops: 0, closeTime: 5.0 };

  const finalCloseTime = Math.max(1, closeTime);
  const successTx = ledger.successful_transaction_count || 0;
  const ops = ledger.operation_count || 0;

  return {
    tps: parseFloat((successTx / finalCloseTime).toFixed(2)),
    ops: parseFloat((ops / finalCloseTime).toFixed(2)),
    closeTime: finalCloseTime
  };
}
