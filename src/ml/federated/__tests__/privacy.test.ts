// Tests for Privacy-Preserving Data Collection
const { PrivacyPreservingCollector } = require('../privacy');

describe('PrivacyPreservingCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new PrivacyPreservingCollector({
      epsilon: 1.0,
      delta: 1e-5,
      sensitivity: 1.0,
      minDataSize: 5,
      maxDataSize: 100
    });
  });

  test('should initialize with correct configuration', () => {
    expect(collector.epsilon).toBe(1.0);
    expect(collector.delta).toBe(1e-5);
    expect(collector.sensitivity).toBe(1.0);
    expect(collector.minDataSize).toBe(5);
    expect(collector.maxDataSize).toBe(100);
  });

  test('should apply local differential privacy', () => {
    const value = 10;
    const privatized = collector.applyLocalDP(value, 1.0, 1.0);
    
    expect(privatized).toBeDefined();
    expect(typeof privatized).toBe('number');
    expect(privatized).not.toBe(value); // Should be different due to noise
  });

  test('should generate gaussian random numbers', () => {
    const samples = [];
    for (let i = 0; i < 1000; i++) {
      samples.push(collector.gaussianRandom(0, 1));
    }
    
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
    const std = Math.sqrt(variance);
    
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(Math.abs(std - 1)).toBeLessThan(0.2);
  });

  test('should privatize feature vector', () => {
    const features = [1, 2, 3, 4, 5];
    const privatized = collector.privatizeFeatures(features, 1.0);
    
    expect(privatized).toHaveLength(features.length);
    expect(privatized[0]).not.toBe(features[0]); // Should be different due to noise
  });

  test('should anonymize transaction by removing sensitive fields', () => {
    const tx = {
      amount: 100,
      senderId: 'sender123',
      recipientId: 'recipient456',
      accountId: 'account789',
      publicKey: 'publicKey',
      signature: 'signature',
      timestamp: Date.now()
    };
    
    const anonymized = collector.anonymizeTransaction(tx);
    
    expect(anonymized.senderId).toBeUndefined();
    expect(anonymized.recipientId).toBeUndefined();
    expect(anonymized.accountId).toBeUndefined();
    expect(anonymized.publicKey).toBeUndefined();
    expect(anonymized.signature).toBeUndefined();
    expect(anonymized.amount).toBeDefined();
  });

  test('should hash identifiers consistently', () => {
    const id1 = 'test-id';
    const id2 = 'test-id';
    
    const hash1 = collector.hashIdentifier(id1);
    const hash2 = collector.hashIdentifier(id2);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });

  test('should bin numerical values', () => {
    const value = 1000;
    const binned = collector.binNumericalValue(value, 10);
    
    expect(typeof binned).toBe('number');
    expect(binned).toBeGreaterThanOrEqual(0);
  });

  test('should bucket timestamps', () => {
    const timestamp = Date.now();
    const bucketed = collector.bucketTimestamp(timestamp, 60);
    
    expect(bucketed).toBeInstanceOf(Date);
    expect(bucketed.getTime()).toBeLessThanOrEqual(timestamp);
  });

  test('should validate data correctly', () => {
    const validData = [
      { features: [1, 2, 3] },
      { features: [4, 5, 6] },
      { features: [7, 8, 9] },
      { features: [10, 11, 12] },
      { features: [13, 14, 15] }
    ];
    
    expect(collector.validateData(validData)).toBe(true);
    
    const invalidDataTooSmall = [
      { features: [1, 2, 3] }
    ];
    expect(collector.validateData(invalidDataTooSmall)).toBe(false);
    
    const invalidDataTooLarge = Array(101).fill({ features: [1, 2, 3] });
    expect(collector.validateData(invalidDataTooLarge)).toBe(false);
  });

  test('should prepare data batch for federated learning', () => {
    const transactions = [
      { amount: 100, timestamp: Date.now(), senderFreq: 5, recipientFreq: 3, inputs: 2, outputs: 1, geoDistance: 1000, isFraud: 0 },
      { amount: 5000, timestamp: Date.now(), senderFreq: 1, recipientFreq: 10, inputs: 5, outputs: 3, geoDistance: 5000, isFraud: 1 },
      { amount: 200, timestamp: Date.now(), senderFreq: 8, recipientFreq: 2, inputs: 1, outputs: 1, geoDistance: 500, isFraud: 0 },
      { amount: 3000, timestamp: Date.now(), senderFreq: 2, recipientFreq: 5, inputs: 3, outputs: 2, geoDistance: 2000, isFraud: 1 },
      { amount: 150, timestamp: Date.now(), senderFreq: 6, recipientFreq: 4, inputs: 2, outputs: 1, geoDistance: 800, isFraud: 0 }
    ];
    
    const batch = collector.prepareDataBatch(transactions, 1.0);
    
    expect(batch.features).toHaveLength(5);
    expect(batch.labels).toHaveLength(5);
    expect(batch.numSamples).toBe(5);
    expect(batch.privacyBudget).toBe(1.0);
    expect(batch.labels[0]).toEqual([1, 0]);
    expect(batch.labels[1]).toEqual([0, 1]);
  });

  test('should generate secure aggregation masks', () => {
    const numClients = 5;
    const vectorSize = 10;
    
    const masks = collector.generateSecureAggregationMask(numClients, vectorSize);
    
    expect(masks).toHaveLength(numClients);
    expect(masks[0]).toHaveLength(vectorSize);
    expect(masks[0] instanceof Float32Array).toBe(true);
  });

  test('should apply and remove masks correctly', () => {
    const vector = [1, 2, 3, 4, 5];
    const mask = [0.5, 0.3, 0.7, 0.2, 0.4];
    
    const masked = collector.applyMask(vector, mask);
    expect(masked[0]).toBe(1.5);
    
    const unmasked = collector.removeMask(masked, mask);
    expect(unmasked[0]).toBeCloseTo(1);
  });

  test('should calculate privacy budget', () => {
    const operations = [
      { epsilon: 0.3 },
      { epsilon: 0.4 },
      { epsilon: 0.2 }
    ];
    
    const budget = collector.calculatePrivacyBudget(operations);
    
    expect(budget.used).toBe(0.9);
    expect(budget.remaining).toBeCloseTo(0.1);
    expect(budget.percentage).toBe(90);
  });

  test('should check privacy requirements', () => {
    const validData = [
      { amount: 100, features: [1, 2, 3] },
      { amount: 200, features: [4, 5, 6] }
    ];
    
    const result = collector.meetsPrivacyRequirements(validData);
    expect(result.valid).toBe(true);
    
    const invalidData = [
      { senderId: 'test', amount: 100, features: [1, 2, 3] }
    ];
    
    const invalidResult = collector.meetsPrivacyRequirements(invalidData);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.reason).toContain('identifiers');
  });
});
