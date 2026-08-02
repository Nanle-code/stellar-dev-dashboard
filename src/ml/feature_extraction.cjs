// Simple feature extraction for transactions
function safeNumber(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

function extractFeatures(tx) {
  // tx expected fields: amount, timestamp, senderFreq, recipientFreq, inputs, outputs, geoDistance
  const amount = Math.log1p(safeNumber(tx.amount));
  const hour = ((new Date(tx.timestamp || Date.now())).getHours() || 0) / 23;
  const senderFreq = Math.log1p(safeNumber(tx.senderFreq));
  const recipientFreq = Math.log1p(safeNumber(tx.recipientFreq));
  const inputs = safeNumber(tx.inputs || 0);
  const outputs = safeNumber(tx.outputs || 0);
  const geo = Math.log1p(Math.abs(safeNumber(tx.geoDistance || 0)));

  return [amount, hour, senderFreq, recipientFreq, inputs, outputs, geo];
}

module.exports = { extractFeatures };
