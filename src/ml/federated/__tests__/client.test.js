// Tests for Federated Learning Client
const { FederatedClient } = require('../client');
const tf = require('@tensorflow/tfjs-node');

describe('FederatedClient', () => {
  let client;

  beforeEach(() => {
    client = new FederatedClient({
      clientId: 'test-client',
      serverUrl: 'http://localhost:4002',
      localEpochs: 2,
      batchSize: 4
    });
  });

  afterEach(async () => {
    if (client.model) {
      client.model.dispose();
    }
  });

  test('should initialize with correct configuration', () => {
    expect(client.clientId).toBe('test-client');
    expect(client.serverUrl).toBe('http://localhost:4002');
    expect(client.localEpochs).toBe(2);
    expect(client.batchSize).toBe(4);
  });

  test('should initialize model with correct architecture', () => {
    const inputShape = 7;
    const model = client.initializeModel(inputShape);
    
    expect(model).toBeDefined();
    expect(model.layers.length).toBe(5);
    expect(model.layers[0].inputShape).toEqual([null, inputShape]);
    expect(model.layers[model.layers.length - 1].units).toBe(2);
  });

  test('should apply differential privacy to weights', () => {
    const weights = [tf.tensor([1, 2, 3]), tf.tensor([4, 5, 6])];
    const noisyWeights = client.applyDifferentialPrivacy(weights, 1.0, 1e-5);
    
    expect(noisyWeights.length).toBe(weights.length);
    expect(noisyWeights[0].shape).toEqual(weights[0].shape);
    
    // Check that values are different (noisy)
    const originalValues = weights[0].dataSync();
    const noisyValues = noisyWeights[0].dataSync();
    expect(noisyValues[0]).not.toBe(originalValues[0]);
    
    // Cleanup
    weights.forEach(w => w.dispose());
    noisyWeights.forEach(w => w.dispose());
  });

  test('should serialize weights correctly', () => {
    const weights = [tf.tensor([1, 2, 3], [3, 1])];
    const serialized = client.serializeWeights(weights);
    
    expect(serialized).toHaveLength(1);
    expect(serialized[0].shape).toEqual([3, 1]);
    expect(serialized[0].data).toEqual([1, 2, 3]);
    
    weights[0].dispose();
  });

  test('should prepare transaction data correctly', () => {
    const transactions = [
      { amount: 100, timestamp: Date.now(), senderFreq: 5, recipientFreq: 3, inputs: 2, outputs: 1, geoDistance: 1000, isFraud: 0 },
      { amount: 5000, timestamp: Date.now(), senderFreq: 1, recipientFreq: 10, inputs: 5, outputs: 3, geoDistance: 5000, isFraud: 1 }
    ];
    
    const { features, labels } = client.prepareTransactionData(transactions);
    
    expect(features).toHaveLength(2);
    expect(labels).toHaveLength(2);
    expect(features[0]).toHaveLength(7);
    expect(labels[0]).toEqual([1, 0]);
    expect(labels[1]).toEqual([0, 1]);
  });

  test('should train locally on sample data', async () => {
    const data = [
      [0.1, 0.5, 0.3, 0.2, 0.4, 0.1, 0.6],
      [0.8, 0.2, 0.9, 0.7, 0.3, 0.5, 0.4]
    ];
    const labels = [
      [1, 0],
      [0, 1]
    ];
    
    const update = await client.localTrain(data, labels);
    
    expect(update).toBeDefined();
    expect(update.weights).toBeDefined();
    expect(update.numExamples).toBe(2);
    expect(update.metrics).toBeDefined();
    expect(update.metrics.loss).toBeDefined();
    expect(update.metrics.accuracy).toBeDefined();
    
    // Cleanup
    update.weights.forEach(w => w.dispose());
  });

  test('should handle gaussian random generation', () => {
    const samples = [];
    for (let i = 0; i < 1000; i++) {
      samples.push(client.gaussianRandom(0, 1));
    }
    
    // Check that mean is approximately 0 and std is approximately 1
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
    const std = Math.sqrt(variance);
    
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(Math.abs(std - 1)).toBeLessThan(0.2);
  });
});
