// Federated Learning Integration with Existing ML Infrastructure
const { FederatedClient } = require('./client');
const { FederatedServer } = require('./server');
const { PrivacyPreservingCollector } = require('./privacy');
const { scoreTransaction, loadModels } = require('../scoringEngine');
const { IsolationForest } = require('../isolation_forest');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

class FederatedLearningIntegration {
  constructor(config = {}) {
    this.enableFederatedLearning = config.enableFederatedLearning !== false;
    this.federatedServerUrl = config.federatedServerUrl || 'http://localhost:4002';
    this.privacyConfig = config.privacy || {};
    this.clientConfig = config.client || {};
    
    this.federatedClient = null;
    this.privacyCollector = new PrivacyPreservingCollector(this.privacyConfig);
    this.isInitialized = false;
  }

  // Initialize federated learning system
  async initialize() {
    if (!this.enableFederatedLearning) {
      console.log('Federated learning is disabled');
      return false;
    }

    try {
      // Initialize federated client
      this.federatedClient = new FederatedClient({
        ...this.clientConfig,
        serverUrl: this.federatedServerUrl
      });

      // Load existing ML models
      await loadModels();

      this.isInitialized = true;
      console.log('Federated learning integration initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize federated learning:', error.message);
      return false;
    }
  }

  // Score transaction with combined models (existing + federated)
  async scoreTransactionWithFederated(tx) {
    // Get score from existing ML infrastructure
    const existingScore = await scoreTransaction(tx);
    
    // If federated learning is available, get federated model prediction
    let federatedScore = null;
    if (this.isInitialized && this.federatedClient.model) {
      try {
        const features = this.privacyCollector.privatizeTransaction(tx).features;
        const prediction = await this.federatedClient.model.predict(
          tf.tensor2d([features])
        );
        const result = await prediction.array();
        federatedScore = result[0][1]; // Probability of fraud
        prediction.dispose();
      } catch (error) {
        console.error('Federated scoring error:', error.message);
      }
    }

    // Combine scores with weighted average
    if (federatedScore !== null) {
      const combinedScore = 0.6 * existingScore.score + 0.4 * federatedScore;
      return {
        score: combinedScore,
        isFraud: combinedScore > 0.6,
        explanation: {
          ...existingScore.explanation,
          federatedScore,
          combinedScore,
          model: 'hybrid'
        }
      };
    }

    return existingScore;
  }

  // Participate in federated learning round with local data
  async participateInFederatedRound(transactions) {
    if (!this.isInitialized || !this.federatedClient) {
      console.log('Federated learning not initialized');
      return null;
    }

    try {
      // Prepare data with privacy preservation
      const dataBatch = this.privacyCollector.prepareDataBatch(
        transactions,
        this.privacyConfig.epsilon || 1.0
      );

      // Participate in round
      const result = await this.federatedClient.participateInRound(
        dataBatch.features,
        dataBatch.labels
      );

      console.log('Federated learning round completed:', result);
      return result;
    } catch (error) {
      console.error('Federated learning round failed:', error.message);
      throw error;
    }
  }

  // Train hybrid model combining Isolation Forest and Federated Learning
  async trainHybridModel(transactions, labels) {
    console.log('Training hybrid model...');

    // Train Isolation Forest (existing)
    const features = transactions.map(tx => {
      const { extractFeatures } = require('../feature_extraction');
      return extractFeatures(tx);
    });
    
    const iforest = new IsolationForest(80, Math.min(256, features.length));
    iforest.fit(features);

    // Train federated model
    const dataBatch = this.privacyCollector.prepareDataBatch(
      transactions,
      this.privacyConfig.epsilon || 1.0
    );

    await this.federatedClient.localTrain(
      dataBatch.features,
      dataBatch.labels
    );

    // Save models
    const modelsDir = path.resolve(__dirname, '..', '..', '..', 'ml_models');
    fs.mkdirSync(modelsDir, { recursive: true });

    // Save Isolation Forest
    iforest.save(path.join(modelsDir, 'isolation_forest_hybrid.json'));

    // Save federated model
    if (this.federatedClient.model) {
      await this.federatedClient.model.save('file://' + path.join(modelsDir, 'federated_model_hybrid'));
    }

    console.log('Hybrid model training completed');
    return { success: true };
  }

  // Get federated learning status
  getFederatedStatus() {
    return {
      enabled: this.enableFederatedLearning,
      initialized: this.isInitialized,
      serverUrl: this.federatedServerUrl,
      hasClient: !!this.federatedClient,
      hasModel: !!this.federatedClient?.model
    };
  }

  // Collect feedback for federated learning
  async collectFeedback(tx, label, privacyBudget = 0.5) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      // Privatize transaction
      const privatized = this.privacyCollector.privatizeTransaction(tx, privacyBudget);
      
      // Store feedback
      const feedbackDir = path.resolve(__dirname, 'data');
      fs.mkdirSync(feedbackDir, { recursive: true });
      
      const feedbackPath = path.join(feedbackDir, 'federated_feedback.json');
      const existingFeedback = fs.existsSync(feedbackPath) 
        ? JSON.parse(fs.readFileSync(feedbackPath))
        : [];
      
      existingFeedback.push({
        tx: privatized,
        label,
        timestamp: Date.now(),
        privacyBudget
      });
      
      fs.writeFileSync(feedbackPath, JSON.stringify(existingFeedback, null, 2));
      
      return { success: true };
    } catch (error) {
      console.error('Feedback collection failed:', error.message);
      throw error;
    }
  }

  // Evaluate model performance
  async evaluateModel(testData, testLabels) {
    if (!this.federatedClient?.model) {
      throw new Error('No federated model available');
    }

    const features = testData.map(tx => {
      const privatized = this.privacyCollector.privatizeTransaction(tx);
      return privatized.features;
    });

    const xs = tf.tensor2d(features);
    const predictions = await this.federatedClient.model.predict(xs);
    const predArray = await predictions.array();

    // Calculate accuracy
    let correct = 0;
    for (let i = 0; i < predArray.length; i++) {
      const predicted = predArray[i][1] > 0.5 ? 1 : 0;
      const actual = testLabels[i];
      if (predicted === actual) correct++;
    }

    const accuracy = correct / predArray.length;
    
    xs.dispose();
    predictions.dispose();

    return {
      accuracy,
      totalSamples: predArray.length,
      correctPredictions: correct
    };
  }

  // Sync with federated server
  async syncWithServer() {
    if (!this.isInitialized || !this.federatedClient) {
      return null;
    }

    try {
      // Load latest global model
      const loaded = await this.federatedClient.loadGlobalModel();
      
      if (loaded) {
        console.log('Synced with federated server');
      }
      
      return loaded;
    } catch (error) {
      console.error('Sync failed:', error.message);
      return false;
    }
  }
}

module.exports = { FederatedLearningIntegration };
