/**
 * AI Summarizer Engine
 * 
 * Provides lightweight, in-browser statistical analysis and machine learning heuristics
 * (linear regression, Z-score/IQR outlier detection) to generate natural language
 * summaries and insights from Stellar network data.
 */

// --- Statistical Math Helpers ---

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

const mean = (arr) => (arr.length === 0 ? 0 : sum(arr) / arr.length);

const median = (arr) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const variance = (arr) => {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return mean(arr.map((num) => Math.pow(num - m, 2)));
};

const stdDev = (arr) => Math.sqrt(variance(arr));

// --- Machine Learning & Heuristics ---

/**
 * Calculates a simple linear regression (least squares) to find trends in time-series data.
 * Returns the slope and intercept.
 * Slope > 0 indicates an upward trend; Slope < 0 indicates a downward trend.
 */
const linearRegression = (xData, yData) => {
  const n = xData.length;
  if (n === 0 || n !== yData.length) return { slope: 0, intercept: 0 };

  const xMean = mean(xData);
  const yMean = mean(yData);

  let num = 0;
  let den = 0;

  for (let i = 0; i < n; i++) {
    num += (xData[i] - xMean) * (yData[i] - yMean);
    den += Math.pow(xData[i] - xMean, 2);
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  return { slope, intercept };
};

/**
 * Detects outliers using the Interquartile Range (IQR) method.
 * Robust against extreme values compared to Z-Score.
 */
const detectOutliersIQR = (data, valueExtractor) => {
  if (data.length < 4) return []; // Not enough data for quartiles

  const values = data.map(valueExtractor).sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return data.filter(item => {
    const val = valueExtractor(item);
    return val < lowerBound || val > upperBound;
  });
};

// --- Insight Generation ---

/**
 * Analyzes transaction history and generates insights.
 * @param {Array} transactions - Array of transaction objects from Horizon
 * @returns {Object} Extracted insights, trends, and NLG strings
 */
export const analyzeTransactions = (transactions) => {
  if (!transactions || transactions.length === 0) {
    return {
      status: 'insufficient_data',
      summaryText: 'Not enough transactions to generate meaningful insights.',
      outliers: [],
      metrics: null
    };
  }

  // Extract fees and operation counts
  const fees = transactions.map(tx => parseFloat(tx.fee_charged || 0));
  const opCounts = transactions.map(tx => parseInt(tx.operation_count || 1, 10));
  
  // Time-series data for trend analysis (using indices as pseudo-time for recent activity)
  // Reversing so oldest is first
  const reversedTxs = [...transactions].reverse();
  const timeSeriesX = reversedTxs.map((_, i) => i);
  const timeSeriesFees = reversedTxs.map(tx => parseFloat(tx.fee_charged || 0));
  
  // Calculate stats
  const avgFee = mean(fees);
  const maxFee = Math.max(...fees);
  const avgOps = mean(opCounts);

  // Detect Outliers (Fees)
  const feeOutliers = detectOutliersIQR(transactions, tx => parseFloat(tx.fee_charged || 0));
  
  // Trend Analysis
  const feeTrend = linearRegression(timeSeriesX, timeSeriesFees);
  
  // --- Natural Language Generation (NLG) ---
  const insights = [];
  
  // 1. Fee Insights
  if (feeOutliers.length > 0) {
    insights.push(`Detected ${feeOutliers.length} anomalous transaction(s) with unusually high fees (max ${maxFee} stroops).`);
  } else {
    insights.push(`Transaction fees are stable, averaging ${Math.round(avgFee)} stroops.`);
  }

  // 2. Trend Insights
  if (feeTrend.slope > Math.abs(avgFee * 0.1)) {
    insights.push(`There is a noticeable upward trend in transaction fees over the recent activity period.`);
  } else if (feeTrend.slope < -Math.abs(avgFee * 0.1)) {
    insights.push(`Transaction fees are trending downwards recently.`);
  }

  // 3. Operation Insights
  if (avgOps > 2) {
    insights.push(`This account frequently batches multiple operations per transaction (avg ${avgOps.toFixed(1)} ops/tx).`);
  } else {
    insights.push(`Most transactions are simple single-operation actions.`);
  }

  // 4. Success Rate
  const successCount = transactions.filter(tx => tx.successful).length;
  const successRate = (successCount / transactions.length) * 100;
  if (successRate < 90) {
    insights.push(`Warning: The transaction success rate is unusually low at ${successRate.toFixed(1)}%.`);
  } else if (successRate === 100) {
    insights.push(`Flawless execution record with a 100% transaction success rate in the recent window.`);
  }

  return {
    status: 'success',
    summaryText: insights.join(' '),
    bulletPoints: insights,
    outliers: feeOutliers,
    metrics: {
      avgFee,
      maxFee,
      avgOps,
      successRate,
      trendSlope: feeTrend.slope
    }
  };
};

/**
 * Generates an overall dashboard summary combining account data, transactions, and network state.
 */
export const generateOverallSummary = (accountData, transactions, networkStats) => {
  if (!accountData) return null;

  const txAnalysis = analyzeTransactions(transactions);
  let summary = `Account ${accountData.id.substring(0, 5)}... has a balance of ${parseFloat(accountData.balances.find(b => b.asset_type === 'native')?.balance || 0).toFixed(2)} XLM. `;
  
  if (txAnalysis.status === 'success') {
    summary += txAnalysis.summaryText;
  }
  
  if (networkStats) {
    summary += ` The network is currently operating smoothly with a base fee of ${networkStats.baseFee} stroops.`;
  }

  return {
    text: summary,
    txAnalysis
  };
};
