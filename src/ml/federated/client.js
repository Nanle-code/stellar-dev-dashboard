// Federated Learning Client - Local model training with privacy preservation
const tf = require('@tensorflow/tfjs-node');
const { extractFeatures } = require('../feature_extraction');
const crypto = require('crypto');

class FederatedClient {
  constructor(config = {}) {
    this.clientId = config.clientId || crypto.randomUUID();
    this.serverUrl = config.serverUrl || 'http://localhost:4002';
    this.localEpochs = config.localEpochs || 5;
    this.batchSize = config.batchSize || 32;
    this.learningRate = config.learningRate || 0.001;
    this.privacyBudget = config.privacyBudget || 1.0;
    this.model = null;
    this.currentRound = 0;
  }

  // Initialize local model architecture
  initializeModel(inputShape) {
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [inputShape]
    }));
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    this.model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    this.model.add(tf.layers.dropout({ rate: 0.1 }));
    this.model.add(tf.layers.dense({
      units: 2,
      activation: 'softmax'
    }));

    this.model.compile({
      optimizer: tf.train.adam(this.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return this.model;
  }

  // Load global model from server
  async loadGlobalModel() {
    try {
      const response = await fetch(`${this.serverUrl}/global-model`);
      if (!response.ok) {
        console.log('No global model available, initializing local model');
        return null;
      }
      
      const modelData = await response.json();
      if (modelData.modelWeights) {
        if (!this.model) {
          this.initializeModel(modelData.inputShape);
        }
        await this.model.setWeights(modelData.modelWeights);
        this.currentRound = modelData.round || 0;
        console.log(`Loaded global model for round ${this.currentRound}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading global model:', error.message);
      return false;
    }
  }

  // Train locally on private data
  async localTrain(data, labels) {
    if (!this.model) {
      const featureDim = data[0].length;
      this.initializeModel(featureDim);
    }

    const xs = tf.tensor2d(data);
    const ys = tf.tensor2d(labels);

    // Apply differential privacy noise to gradients
    const originalGradients = [];
    this.model.compile({
      optimizer: tf.train.adam(this.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    const history = await this.model.fit(xs, ys, {
      epochs: this.localEpochs,
      batchSize: this.batchSize,
      validationSplit: 0.2,
      verbose: 0
    });

    // Get model weights for federated averaging
    const weights = this.model.getWeights();
    
    // Apply differential privacy to weights
    const noisyWeights = this.applyDifferentialPrivacy(weights);

    xs.dispose();
    ys.dispose();

    return {
      weights: noisyWeights,
      numExamples: data.length,
      metrics: {
        loss: history.history.loss[history.history.loss.length - 1],
        accuracy: history.history.accuracy[history.history.accuracy.length - 1]
      }
    };
  }

  // Apply differential privacy noise to model weights
  applyDifferentialPrivacy(weights, epsilon = 1.0, delta = 1e-5) {
    const sensitivity = 1.0;
    const sigma = Math.sqrt(2 * Math.log(1.25 / delta)) * sensitivity / epsilon;
    
    return weights.map(tensor => {
      const values = tensor.dataSync();
      const noisyValues = new Float32Array(values.length);
      
      for (let i = 0; i < values.length; i++) {
        // Add Gaussian noise
        const noise = this.gaussianRandom(0, sigma);
        noisyValues[i] = values[i] + noise;
      }
      
      return tf.tensor(noisyValues, tensor.shape);
    });
  }

  // Gaussian random number generator (Box-Muller transform)
  gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
  }

  // Serialize model weights for transmission
  serializeWeights(weights) {
    return weights.map(tensor => ({
      shape: tensor.shape,
      data: Array.from(tensor.dataSync())
    }));
  }

  // Send local model update to server
  async sendUpdate(update) {
    try {
      const serializedWeights = this.serializeWeights(update.weights);
      
      const response = await fetch(`${this.serverUrl}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: this.clientId,
          round: this.currentRound,
          weights: serializedWeights,
          numExamples: update.numExamples,
          metrics: update.metrics,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      console.log('Update sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending update:', error.message);
      throw error;
    }
  }

  // Complete federated learning round
  async participateInRound(data, labels) {
    console.log(`Client ${this.clientId} starting federated learning round`);
    
    // Load global model
    await this.loadGlobalModel();
    
    // Train locally
    const update = await this.localTrain(data, labels);
    
    // Send update to server
    const result = await this.sendUpdate(update);
    
    this.currentRound++;
    return result;
  }

  // Prepare transaction data for federated training
  prepareTransactionData(transactions) {
    const features = transactions.map(tx => extractFeatures(tx));
    const labels = transactions.map(tx => {
      // Convert label to one-hot encoding
      const isFraud = tx.isFraud || tx.label || 0;
      return [1 - isFraud, isFraud];
    });
    
    return { features, labels };
  }
}

module.exports = { FederatedClient };
