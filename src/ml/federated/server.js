// Federated Learning Aggregation Server
const express = require('express');
const bodyParser = require('body-parser');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

class FederatedServer {
  constructor(config = {}) {
    this.port = config.port || 4002;
    this.minClients = config.minClients || 3;
    this.maxClients = config.maxClients || 10;
    this.roundTimeout = config.roundTimeout || 300000; // 5 minutes
    this.aggregationStrategy = config.aggregationStrategy || 'fedavg';
    
    this.app = express();
    this.app.use(bodyParser.json({ limit: '50mb' }));
    
    this.currentRound = 0;
    this.globalModel = null;
    this.clientUpdates = new Map();
    this.roundStartTime = null;
    this.modelHistory = [];
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Get global model
    this.app.get('/global-model', (req, res) => {
      try {
        if (!this.globalModel) {
          return res.status(404).json({ error: 'No global model available' });
        }
        
        const weights = this.globalModel.getWeights();
        const serializedWeights = weights.map(tensor => ({
          shape: tensor.shape,
          data: Array.from(tensor.dataSync())
        }));
        
        res.json({
          round: this.currentRound,
          modelWeights: serializedWeights,
          inputShape: weights[0].shape[0],
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Receive client update
    this.app.post('/update', async (req, res) => {
      try {
        const { clientId, round, weights, numExamples, metrics } = req.body;
        
        // Validate round
        if (round !== this.currentRound) {
          return res.status(400).json({ 
            error: `Round mismatch. Expected ${this.currentRound}, got ${round}` 
          });
        }
        
        // Deserialize weights
        const tensorWeights = weights.map(w => {
          return tf.tensor(w.data, w.shape);
        });
        
        // Store update
        this.clientUpdates.set(clientId, {
          weights: tensorWeights,
          numExamples,
          metrics,
          timestamp: Date.now()
        });
        
        console.log(`Received update from client ${clientId}. Total updates: ${this.clientUpdates.size}`);
        
        // Check if we have enough updates to aggregate
        if (this.clientUpdates.size >= this.minClients) {
          await this.aggregateUpdates();
        }
        
        res.json({ 
          success: true, 
          round: this.currentRound,
          pendingUpdates: this.clientUpdates.size 
        });
      } catch (error) {
        console.error('Error processing update:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get current round status
    this.app.get('/status', (req, res) => {
      res.json({
        round: this.currentRound,
        clients: this.clientUpdates.size,
        minClients: this.minClients,
        isAggregating: this.clientUpdates.size >= this.minClients,
        timestamp: Date.now()
      });
    });

    // Initialize new round
    this.app.post('/initialize-round', (req, res) => {
      try {
        this.currentRound++;
        this.clientUpdates.clear();
        this.roundStartTime = Date.now();
        
        console.log(`Initialized round ${this.currentRound}`);
        
        res.json({ 
          success: true, 
          round: this.currentRound 
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get model history
    this.app.get('/history', (req, res) => {
      res.json({
        history: this.modelHistory,
        currentRound: this.currentRound
      });
    });

    // Save current model
    this.app.post('/save-model', async (req, res) => {
      try {
        if (!this.globalModel) {
          return res.status(400).json({ error: 'No model to save' });
        }
        
        const modelsDir = path.resolve(__dirname, '..', '..', '..', 'ml_models');
        fs.mkdirSync(modelsDir, { recursive: true });
        
        const modelPath = path.join(modelsDir, `federated_model_round_${this.currentRound}`);
        await this.globalModel.save('file://' + modelPath);
        
        // Also save as latest
        const latestPath = path.join(modelsDir, 'federated_model_latest');
        await this.globalModel.save('file://' + latestPath);
        
        res.json({ 
          success: true, 
          path: modelPath 
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // Federated Averaging (FedAvg) algorithm
  async aggregateUpdates() {
    console.log(`Aggregating ${this.clientUpdates.size} client updates...`);
    
    const updates = Array.from(this.clientUpdates.values());
    const totalExamples = updates.reduce((sum, update) => sum + update.numExamples, 0);
    
    // Initialize aggregated weights with first update
    const aggregatedWeights = updates[0].weights.map(tensor => 
      tf.zerosLike(tensor).mul(updates[0].numExamples / totalExamples)
    );
    
    // Weighted average of all updates
    for (const update of updates) {
      const weight = update.numExamples / totalExamples;
      
      for (let i = 0; i < update.weights.length; i++) {
        const weighted = update.weights[i].mul(weight);
        aggregatedWeights[i] = aggregatedWeights[i].add(weighted);
        weighted.dispose();
      }
    }
    
    // Update or create global model
    if (!this.globalModel) {
      this.globalModel = tf.sequential();
      this.globalModel.add(tf.layers.dense({
        units: 64,
        activation: 'relu',
        inputShape: [aggregatedWeights[0].shape[0]]
      }));
      this.globalModel.add(tf.layers.dropout({ rate: 0.2 }));
      this.globalModel.add(tf.layers.dense({
        units: 32,
        activation: 'relu'
      }));
      this.globalModel.add(tf.layers.dropout({ rate: 0.1 }));
      this.globalModel.add(tf.layers.dense({
        units: 2,
        activation: 'softmax'
      }));
      
      this.globalModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
    }
    
    // Set aggregated weights
    this.globalModel.setWeights(aggregatedWeights);
    
    // Calculate average metrics
    const avgMetrics = this.calculateAverageMetrics(updates);
    
    // Save to history
    this.modelHistory.push({
      round: this.currentRound,
      timestamp: Date.now(),
      numClients: updates.length,
      totalExamples: totalExamples,
      metrics: avgMetrics
    });
    
    // Clean up tensors
    aggregatedWeights.forEach(tensor => tensor.dispose());
    updates.forEach(update => {
      update.weights.forEach(tensor => tensor.dispose());
    });
    
    this.clientUpdates.clear();
    
    console.log(`Aggregation complete for round ${this.currentRound}`);
    console.log(`Average metrics:`, avgMetrics);
  }

  // Calculate average metrics across all updates
  calculateAverageMetrics(updates) {
    const numUpdates = updates.length;
    const avgLoss = updates.reduce((sum, u) => sum + (u.metrics?.loss || 0), 0) / numUpdates;
    const avgAccuracy = updates.reduce((sum, u) => sum + (u.metrics?.accuracy || 0), 0) / numUpdates;
    
    return {
      loss: avgLoss,
      accuracy: avgAccuracy
    };
  }

  // Load existing model
  async loadModel(modelPath) {
    try {
      const modelsDir = path.resolve(__dirname, '..', '..', '..', 'ml_models');
      const pathToLoad = modelPath || path.join(modelsDir, 'federated_model_latest', 'model.json');
      
      if (fs.existsSync(pathToLoad)) {
        this.globalModel = await tf.loadLayersModel('file://' + pathToLoad);
        console.log('Loaded existing model');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading model:', error.message);
      return false;
    }
  }

  // Start server
  start() {
    this.app.listen(this.port, () => {
      console.log(`Federated learning server running on port ${this.port}`);
      console.log(`Minimum clients for aggregation: ${this.minClients}`);
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new FederatedServer({
    port: process.env.PORT || 4002,
    minClients: 3,
    maxClients: 10
  });
  
  // Try to load existing model
  server.loadModel().then(() => {
    server.start();
  });
}

module.exports = { FederatedServer };
