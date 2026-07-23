/**
 * AI Correlation Engine
 * Computes Pearson correlation and provides AI-driven relationship explanations.
 */

function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;

  return numerator / denominator;
}

function explainRelationship(metric1, metric2, correlation) {
  const isPositive = correlation > 0;
  const strength = Math.abs(correlation) > 0.85 ? "strong" : "moderate";
  
  const rules = {
    "transactions-fees": isPositive 
      ? "High transaction volume increases network congestion, leading to higher base fees." 
      : "Lower transaction volume is correlating with stable/lower fees.",
    "successRate-fees": isPositive
      ? "Higher fees might be deterring spam, leading to a higher overall success rate for legitimate transactions."
      : "High fees could be causing under-funded transactions to fail.",
    "transactions-successRate": isPositive
      ? "High activity is being handled efficiently by the network."
      : "High volume spikes are causing network saturation and dropping the success rate."
  };

  const key1 = `${metric1}-${metric2}`;
  const key2 = `${metric2}-${metric1}`;
  
  const explanation = rules[key1] || rules[key2] || 
    `There is a ${strength} ${isPositive ? 'positive' : 'negative'} correlation between ${metric1} and ${metric2}. ` +
    (isPositive 
      ? `As ${metric1} increases, ${metric2} tends to increase.` 
      : `As ${metric1} increases, ${metric2} tends to decrease.`);

  return explanation;
}

function analyzeCorrelations(timeseriesData) {
  if (!timeseriesData || timeseriesData.length === 0) return { nodes: [], links: [] };

  const metrics = Object.keys(timeseriesData[0]).filter(k => k !== 'date');
  
  const vectors = {};
  metrics.forEach(m => {
    vectors[m] = timeseriesData.map(d => Number(d[m]) || 0);
  });

  const nodes = metrics.map(m => ({ id: m, label: m.charAt(0).toUpperCase() + m.slice(1).replace(/([A-Z])/g, ' $1').trim() }));
  const links = [];

  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const m1 = metrics[i];
      const m2 = metrics[j];
      const r = pearsonCorrelation(vectors[m1], vectors[m2]);
      
      // Correlation threshold > 0.65 to filter noise
      if (Math.abs(r) > 0.65) { 
        links.push({
          source: m1,
          target: m2,
          value: r,
          explanation: explainRelationship(m1, m2, r)
        });
      }
    }
  }

  return { nodes, links };
}

module.exports = { analyzeCorrelations, pearsonCorrelation };
