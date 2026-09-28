import { IsolationForest } from '../ml/isolation_forest.js';

export class AnomalyDetectionPipeline {
  private model: IsolationForest;
  private isTrained: boolean = false;
  private transactionHistory: any[] = [];
  private threshold: number = 0.7; // Sensitivity threshold

  constructor() {
    this.model = new IsolationForest(50, 256);
  }

  // Features could be: amount, time of day, frequency, etc.
  private extractFeatures(tx: any): number[] {
    const amount = tx.amount ? parseFloat(tx.amount) : 0;
    const hour = new Date(tx.timestamp || Date.now()).getHours();
    return [amount, hour];
  }

  public train(historicalTransactions: any[]) {
    this.transactionHistory = historicalTransactions;
    const trainingData = historicalTransactions.map(tx => this.extractFeatures(tx));
    if (trainingData.length > 0) {
      this.model.fit(trainingData);
      this.isTrained = true;
    }
  }

  public setSensitivity(threshold: number) {
    this.threshold = threshold;
  }

  public processTransaction(tx: any) {
    let score = 0;
    let isAnomaly = false;

    if (this.isTrained) {
      const features = this.extractFeatures(tx);
      score = this.model.anomalyScore(features);
      isAnomaly = score > this.threshold;
    }

    // Add to history and potentially retrain periodically
    this.transactionHistory.push(tx);
    if (this.transactionHistory.length % 100 === 0) {
      this.train(this.transactionHistory);
    }

    return {
      transactionId: tx.id,
      score,
      isAnomaly,
      explanation: isAnomaly ? `Transaction deviates significantly from baseline behavior (score: ${score.toFixed(2)}).` : 'Normal transaction.',
      timestamp: Date.now()
    };
  }
}
