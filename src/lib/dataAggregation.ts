/**
 * AI-Enhanced Data Aggregation System
 * Suggests aggregation strategies, aggregates timeseries data, and evaluates the representation quality.
 */

export type AggregationInterval = 'none' | 'hour' | 'day' | 'week' | 'month';
export type VisualizationType = 'line' | 'bar' | 'pie' | 'table';

export interface DataPoint {
  timestamp: number | string;
  [key: string]: any;
}

export interface AggregationRecommendation {
  interval: AggregationInterval;
  confidence: number; // 0-1
  reasoning: string;
  expectedCompression: number;
}

export interface QualityMetrics {
  score: number; // 0-100
  varianceRetainedPct: number;
  compressionRatio: number;
  informationLossPct: number;
  outliersPreservedPct: number;
  explanation: string;
}

/**
 * Recommends the optimal aggregation interval based on the dataset size, duration, and visual targets.
 */
export function recommendAggregationStrategy(
  data: DataPoint[],
  visualizationType: VisualizationType = 'line',
  userNeed: 'speed' | 'detail' | 'balanced' = 'balanced'
): AggregationRecommendation {
  if (!data || data.length === 0) {
    return { interval: 'none', confidence: 1, reasoning: 'No data to aggregate.', expectedCompression: 1 };
  }

  const count = data.length;

  // Calculate timespan in ms
  const timestamps = data.map(d => new Date(d.timestamp).getTime()).filter(t => !isNaN(t));
  if (timestamps.length < 2) {
    return { interval: 'none', confidence: 0.9, reasoning: 'Dataset is too small to determine trends.', expectedCompression: 1 };
  }

  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timespanMs = maxTime - minTime;
  const timespanDays = timespanMs / (1000 * 60 * 60 * 24);

  // Scoring features
  let recommended: AggregationInterval = 'none';
  let score = 0;
  let reason = '';

  if (visualizationType === 'bar') {
    // Bar charts need a low number of categories (ideal: 5 to 15)
    if (timespanDays > 180) {
      recommended = 'month';
      score = 0.92;
      reason = 'Monthly aggregation is optimal to display a clean seasonal comparison on a bar chart.';
    } else if (timespanDays > 14) {
      recommended = 'week';
      score = 0.88;
      reason = 'Weekly aggregation provides clean, readable bars without overcrowding the visual layout.';
    } else if (timespanDays > 2) {
      recommended = 'day';
      score = 0.9;
      reason = 'Daily bars show day-to-day progression without excessive detail.';
    } else {
      recommended = 'hour';
      score = 0.85;
      reason = 'Hourly aggregation is recommended for high-resolution short-term bar graphs.';
    }
  } else if (visualizationType === 'pie') {
    // Pie charts aggregate everything into static bins or categories. We roll up completely.
    recommended = 'none';
    score = 0.95;
    reason = 'Pie charts require categorical breakdown rather than time-series aggregation.';
  } else {
    // Line charts / general timeseries
    const pointsPerDay = count / Math.max(timespanDays, 0.1);

    if (count > 5000 || (userNeed === 'speed' && count > 500)) {
      if (timespanDays > 365) {
        recommended = 'month';
        score = 0.91;
        reason = `Large dataset (${count} pts) spanning ${Math.round(timespanDays)} days. Monthly aggregation minimizes client load and highlights yearly trends.`;
      } else if (timespanDays > 60) {
        recommended = 'week';
        score = 0.86;
        reason = `High density dataset (${count} pts) spanning several weeks. Weekly aggregation balances load and layout speed.`;
      } else {
        recommended = 'day';
        score = 0.89;
        reason = `Dense data over a short period. Daily rollups reduce noise and render lines smoothly.`;
      }
    } else if (count > 200 || userNeed === 'speed') {
      if (timespanDays > 180) {
        recommended = 'week';
        score = 0.84;
        reason = 'Weekly aggregation filters out high-frequency noise for mid-term trend analysis.';
      } else {
        recommended = 'day';
        score = 0.87;
        reason = 'Daily aggregation presents a crisp daily progression suitable for screen limits.';
      }
    } else {
      recommended = 'none';
      score = 0.95;
      reason = `Small dataset size (${count} points). Rendering raw data is fast and retains 100% of information.`;
    }
  }

  // Calculate expected compression
  let expectedCompression = 1;
  if (recommended === 'hour') expectedCompression = Math.max(1, count / (timespanDays * 24));
  else if (recommended === 'day') expectedCompression = Math.max(1, count / timespanDays);
  else if (recommended === 'week') expectedCompression = Math.max(1, count / (timespanDays / 7));
  else if (recommended === 'month') expectedCompression = Math.max(1, count / (timespanDays / 30));

  return {
    interval: recommended,
    confidence: Math.round(score * 100) / 100,
    reasoning: reason,
    expectedCompression: Math.round(expectedCompression * 10) / 10
  };
}

/**
 * Groups and aggregates a dataset by the specified interval.
 */
export function aggregateData(
  data: DataPoint[],
  timeKey: string,
  valueKeys: string[],
  interval: AggregationInterval,
  method: 'sum' | 'mean' | 'max' | 'min' | 'count' = 'mean'
): DataPoint[] {
  if (interval === 'none' || !data || data.length === 0) return data;

  const groups: { [key: string]: DataPoint[] } = {};

  data.forEach(item => {
    const date = new Date(item[timeKey]);
    if (isNaN(date.getTime())) return;

    let groupKey = '';
    if (interval === 'hour') {
      // YYYY-MM-DD HH:00
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
    } else if (interval === 'day') {
      // YYYY-MM-DD
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } else if (interval === 'week') {
      // Find start of week (Sunday)
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay());
      groupKey = `${sunday.getFullYear()}-W${String(Math.ceil((sunday.getDate() + 1) / 7))}`;
    } else if (interval === 'month') {
      // YYYY-MM
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
  });

  return Object.entries(groups).map(([key, groupItems]) => {
    const aggregated: DataPoint = {
      [timeKey]: key,
      _count: groupItems.length
    };

    valueKeys.forEach(valKey => {
      const vals = groupItems.map(item => Number(item[valKey])).filter(v => !isNaN(v));
      if (vals.length === 0) {
        aggregated[valKey] = null;
        return;
      }

      if (method === 'sum') {
        aggregated[valKey] = vals.reduce((sum, v) => sum + v, 0);
      } else if (method === 'max') {
        aggregated[valKey] = Math.max(...vals);
      } else if (method === 'min') {
        aggregated[valKey] = Math.min(...vals);
      } else if (method === 'count') {
        aggregated[valKey] = vals.length;
      } else {
        // mean
        aggregated[valKey] = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      }
    });

    return aggregated;
  }).sort((a, b) => new Date(a[timeKey]).getTime() - new Date(b[timeKey]).getTime());
}

/**
 * Assesses the quality of the aggregated dataset compared to the raw dataset.
 */
export function assessAggregationQuality(
  raw: DataPoint[],
  aggregated: DataPoint[],
  timeKey: string,
  valueKeys: string[]
): QualityMetrics {
  if (!raw || raw.length === 0 || !aggregated || aggregated.length === 0) {
    return {
      score: 100,
      varianceRetainedPct: 100,
      compressionRatio: 1,
      informationLossPct: 0,
      outliersPreservedPct: 100,
      explanation: 'No aggregation has occurred.'
    };
  }

  const compressionRatio = raw.length / aggregated.length;

  let totalVarRetained = 0;
  let totalInfoLoss = 0;
  let totalOutliersPreserved = 0;
  let valKeyCount = 0;

  valueKeys.forEach(valKey => {
    const rawVals = raw.map(d => Number(d[valKey])).filter(v => !isNaN(v));
    const aggVals = aggregated.map(d => Number(d[valKey])).filter(v => !isNaN(v));

    if (rawVals.length < 2 || aggVals.length < 1) return;

    valKeyCount++;

    // Calculate Variance Retained
    const meanRaw = rawVals.reduce((sum, v) => sum + v, 0) / rawVals.length;
    const meanAgg = aggVals.reduce((sum, v) => sum + v, 0) / aggVals.length;

    const varRaw = rawVals.reduce((sum, v) => sum + Math.pow(v - meanRaw, 2), 0) / rawVals.length;
    const varAgg = aggVals.reduce((sum, v) => sum + Math.pow(v - meanAgg, 2), 0) / aggVals.length;

    const varRetained = varRaw > 0 ? Math.min(100, (varAgg / varRaw) * 100) : 100;
    totalVarRetained += varRetained;

    // Calculate Information Loss (normalized RMSE on interpolation)
    const minVal = Math.min(...rawVals);
    const maxVal = Math.max(...rawVals);
    const range = maxVal - minVal || 1;

    let sqDiffSum = 0;
    let counts = 0;

    raw.forEach(rItem => {
      const rTime = new Date(rItem[timeKey]).getTime();
      const rVal = Number(rItem[valKey]);
      if (isNaN(rTime) || isNaN(rVal)) return;

      // Find closest aggregated point or interpolate
      let interpolated = aggVals[0];
      let minDiff = Infinity;
      
      aggregated.forEach(aItem => {
        const aTime = new Date(aItem[timeKey]).getTime();
        const aVal = Number(aItem[valKey]);
        if (isNaN(aTime) || isNaN(aVal)) return;
        const diff = Math.abs(rTime - aTime);
        if (diff < minDiff) {
          minDiff = diff;
          interpolated = aVal;
        }
      });

      sqDiffSum += Math.pow(rVal - interpolated, 2);
      counts++;
    });

    const rmse = Math.sqrt(sqDiffSum / (counts || 1));
    const nrmse = Math.min(1, rmse / range);
    const infoLoss = nrmse * 100;
    totalInfoLoss += infoLoss;

    // Outlier Preservation
    const sortedVals = [...rawVals].sort((a,b)=>a-b);
    const q1 = sortedVals[Math.floor(sortedVals.length * 0.25)];
    const q3 = sortedVals[Math.floor(sortedVals.length * 0.75)];
    const iqr = q3 - q1;
    const isOutlier = (v: number) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr;

    const rawOutliers = rawVals.filter(isOutlier);
    if (rawOutliers.length === 0) {
      totalOutliersPreserved += 100;
    } else {
      const aggOutliers = aggVals.filter(isOutlier);
      const preservePct = Math.min(100, (aggOutliers.length / rawOutliers.length) * 100);
      totalOutliersPreserved += preservePct;
    }
  });

  const avgVarRetained = valKeyCount > 0 ? totalVarRetained / valKeyCount : 100;
  const avgInfoLoss = valKeyCount > 0 ? totalInfoLoss / valKeyCount : 0;
  const avgOutliersPreserved = valKeyCount > 0 ? totalOutliersPreserved / valKeyCount : 100;

  let score = 0.45 * (100 - avgInfoLoss) + 0.35 * avgVarRetained + 0.20 * avgOutliersPreserved;
  score = Math.max(0, Math.min(100, score));

  let explanation = '';
  if (score >= 90) explanation = 'Excellent quality: representation perfectly preserves the trend and statistical structure.';
  else if (score >= 75) explanation = 'Good quality: key trends are well-retained, but high-frequency variations are smoothed out.';
  else if (score >= 50) explanation = 'Moderate quality: substantial details and outliers are smoothed; suitable for long-term trends only.';
  else explanation = 'Poor quality: significant details lost, trend may be distorted. Try a smaller aggregation interval.';

  return {
    score: Math.round(score),
    varianceRetainedPct: Math.round(avgVarRetained * 10) / 10,
    compressionRatio: Math.round(compressionRatio * 10) / 10,
    informationLossPct: Math.round(avgInfoLoss * 10) / 10,
    outliersPreservedPct: Math.round(avgOutliersPreserved * 10) / 10,
    explanation
  };
}
