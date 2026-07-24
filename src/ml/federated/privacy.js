// Privacy-Preserving Data Collection System
const crypto = require('crypto');
const { extractFeatures } = require('../feature_extraction');

class PrivacyPreservingCollector {
  constructor(config = {}) {
    this.epsilon = config.epsilon || 1.0; // Differential privacy budget
    this.delta = config.delta || 1e-5; // Failure probability
    this.sensitivity = config.sensitivity || 1.0;
    this.minDataSize = config.minDataSize || 10;
    this.maxDataSize = config.maxDataSize || 1000;
    this.enableLocalDP = config.enableLocalDP !== false;
    this.enableSecureAggregation = config.enableSecureAggregation !== false;
  }

  // Apply local differential privacy to individual data points
  applyLocalDP(value, epsilon = this.epsilon, sensitivity = this.sensitivity) {
    if (!this.enableLocalDP) return value;
    
    const sigma = Math.sqrt(2 * Math.log(1.25 / this.delta)) * sensitivity / epsilon;
    const noise = this.gaussianRandom(0, sigma);
    
    return value + noise;
  }

  // Gaussian random number generator (Box-Muller transform)
  gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
  }

  // Apply DP to feature vector
  privatizeFeatures(features, epsilon = this.epsilon) {
    const epsilonPerFeature = epsilon / features.length;
    return features.map(f => this.applyLocalDP(f, epsilonPerFeature));
  }

  // Data anonymization - remove or hash sensitive identifiers
  anonymizeTransaction(tx) {
    const anonymized = { ...tx };
    
    // Remove sensitive fields
    delete anonymized.senderId;
    delete anonymized.recipientId;
    delete anonymized.accountId;
    delete anonymized.publicKey;
    delete anonymized.signature;
    
    // Hash remaining identifiers if present
    if (anonymized.sender) {
      anonymized.sender = this.hashIdentifier(anonymized.sender);
    }
    if (anonymized.recipient) {
      anonymized.recipient = this.hashIdentifier(anonymized.recipient);
    }
    
    return anonymized;
  }

  // Hash identifier for consistent anonymization
  hashIdentifier(identifier) {
    return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
  }

  // Binning for numerical features to reduce precision
  binNumericalValue(value, bins = 10) {
    if (typeof value !== 'number' || !isFinite(value)) return 0;
    
    // Log-space binning for better distribution
    const logValue = Math.log1p(Math.abs(value));
    const binSize = logValue / bins;
    return Math.floor(binSize) * bins;
  }

  // Time bucketing to reduce temporal precision
  bucketTimestamp(timestamp, bucketMinutes = 60) {
    const date = new Date(timestamp);
    const bucketMs = bucketMinutes * 60 * 1000;
    const bucketed = Math.floor(date.getTime() / bucketMs) * bucketMs;
    return new Date(bucketed);
  }

  // Apply privacy transformations to transaction
  privatizeTransaction(tx, epsilon = this.epsilon) {
    // Anonymize identifiers
    const anonymized = this.anonymizeTransaction(tx);
    
    // Extract features with DP
    const features = extractFeatures(anonymized);
    const privatizedFeatures = this.privatizeFeatures(features, epsilon * 0.7);
    
    // Apply additional transformations
    if (anonymized.amount) {
      anonymized.amount = this.binNumericalValue(anonymized.amount);
    }
    
    if (anonymized.timestamp) {
      anonymized.timestamp = this.bucketTimestamp(anonymized.timestamp);
    }
    
    return {
      ...anonymized,
      features: privatizedFeatures,
      privacyBudgetUsed: epsilon
    };
  }

  // Validate data quality before collection
  validateData(data) {
    if (!Array.isArray(data)) return false;
    if (data.length < this.minDataSize) return false;
    if (data.length > this.maxDataSize) return false;
    
    // Check each data point
    for (const item of data) {
      if (!item || typeof item !== 'object') return false;
      if (!item.features || !Array.isArray(item.features)) return false;
      if (item.features.some(f => !isFinite(f))) return false;
    }
    
    return true;
  }

  // Prepare data batch for federated learning
  prepareDataBatch(transactions, epsilon = this.epsilon) {
    const privatized = transactions.map(tx => this.privatizeTransaction(tx, epsilon));
    
    if (!this.validateData(privatized)) {
      throw new Error('Data validation failed');
    }
    
    // Separate features and labels
    const features = privatized.map(tx => tx.features);
    const labels = privatized.map(tx => {
      const isFraud = tx.isFraud || tx.label || 0;
      return [1 - isFraud, isFraud];
    });
    
    return {
      features,
      labels,
      numSamples: features.length,
      privacyBudget: epsilon
    };
  }

  // Secure aggregation - add client-specific masks
  generateSecureAggregationMask(numClients, vectorSize) {
    const masks = [];
    
    for (let i = 0; i < numClients; i++) {
      const mask = new Float32Array(vectorSize);
      for (let j = 0; j < vectorSize; j++) {
        mask[j] = this.gaussianRandom(0, 1);
      }
      masks.push(mask);
    }
    
    return masks;
  }

  // Apply secure aggregation mask
  applyMask(vector, mask) {
    return vector.map((v, i) => v + mask[i]);
  }

  // Remove secure aggregation mask (for server)
  removeMask(vector, mask) {
    return vector.map((v, i) => v - mask[i]);
  }

  // Calculate privacy budget usage
  calculatePrivacyBudget(operations) {
    let totalEpsilon = 0;
    
    for (const op of operations) {
      totalEpsilon += op.epsilon || 0;
    }
    
    return {
      used: totalEpsilon,
      remaining: this.epsilon - totalEpsilon,
      percentage: (totalEpsilon / this.epsilon) * 100
    };
  }

  // Privacy audit log
  logPrivacyOperation(operation, data) {
    const logEntry = {
      timestamp: Date.now(),
      operation,
      dataSize: Array.isArray(data) ? data.length : 1,
      epsilonUsed: operation.epsilon || this.epsilon,
      method: operation.method || 'unknown'
    };
    
    // In production, this would go to a secure audit log
    console.log('Privacy operation:', JSON.stringify(logEntry));
    
    return logEntry;
  }

  // Check if data meets privacy requirements
  meetsPrivacyRequirements(data, requirements = {}) {
    const minAnonymization = requirements.minAnonymization || 0.8;
    const maxDataPoints = requirements.maxDataPoints || 1000;
    
    // Check data size
    if (data.length > maxDataPoints) {
      return { valid: false, reason: 'Data size exceeds maximum' };
    }
    
    // Check anonymization level (simplified check)
    const hasIdentifiers = data.some(tx => 
      tx.senderId || tx.recipientId || tx.accountId || tx.publicKey
    );
    
    if (hasIdentifiers) {
      return { valid: false, reason: 'Data contains identifiers' };
    }
    
    return { valid: true };
  }
}

module.exports = { PrivacyPreservingCollector };
