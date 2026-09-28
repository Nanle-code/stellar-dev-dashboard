import { Horizon } from '@stellar/stellar-sdk';

export type PriorityLevel = 'Low' | 'Medium' | 'High';

export interface PriorityScoreDetails {
  score: number; // 0 - 100
  level: PriorityLevel;
  features: {
    amount: number;
    fee: number;
    operations: number;
    relationship: number;
    timing: number;
  };
  isSuggested: boolean; // true if predicted by model, false if overridden by user
}

// Default weights for priority model
interface ModelWeights {
  amountWeight: number;
  feeWeight: number;
  operationsWeight: number;
  relationshipWeight: number;
  timingWeight: number;
  bias: number;
}

const DEFAULT_WEIGHTS: ModelWeights = {
  amountWeight: 25,
  feeWeight: 20,
  operationsWeight: 15,
  relationshipWeight: 25,
  timingWeight: 15,
  bias: 0,
};

const STORAGE_KEYS = {
  WEIGHTS: 'stellar:priority-weights',
  OVERRIDES: 'stellar:priority-overrides',
  LABELS: 'address-labels',
};

// Simple learning rate for gradient updates
const LEARNING_RATE = 2.0;

class PriorityScoringService {
  private weights: ModelWeights = { ...DEFAULT_WEIGHTS };
  private overrides: Record<string, PriorityLevel> = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const storedWeights = localStorage.getItem(STORAGE_KEYS.WEIGHTS);
      if (storedWeights) {
        this.weights = JSON.parse(storedWeights);
      }
      const storedOverrides = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
      if (storedOverrides) {
        this.overrides = JSON.parse(storedOverrides);
      }
    } catch (e) {
      console.error('Error loading priority scoring data', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(this.weights));
      localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(this.overrides));
    } catch (e) {
      console.error('Error saving priority scoring data', e);
    }
  }

  public getWeights() {
    return { ...this.weights };
  }

  public getOverrides() {
    return { ...this.overrides };
  }

  public resetModel() {
    this.weights = { ...DEFAULT_WEIGHTS };
    this.overrides = {};
    this.saveToStorage();
  }

  /**
   * Extract features from a transaction for priority scoring
   */
  public extractFeatures(tx: any): PriorityScoreDetails['features'] {
    // 1. Amount feature (log-scaled)
    let rawAmount = 0;
    if (tx.amount) {
      rawAmount = parseFloat(tx.amount);
    } else if (tx.operations && Array.isArray(tx.operations)) {
      rawAmount = tx.operations.reduce((sum: number, op: any) => sum + parseFloat(op.amount || 0), 0);
    }
    const amount = Math.min(1.0, Math.log1p(rawAmount) / 10.0);

    // 2. Fee feature (log-scaled)
    const rawFee = parseFloat(tx.fee_charged || 0);
    const fee = Math.min(1.0, Math.log1p(rawFee) / 12.0);

    // 3. Operations feature
    const rawOps = tx.operation_count || (tx.operations ? tx.operations.length : 1);
    const operations = Math.min(1.0, Math.log1p(rawOps) / 4.0);

    // 4. Counterparty Relationship feature
    let relationship = 0.1;
    // Check if source_account is user/labeled
    try {
      const rawLabels = localStorage.getItem(STORAGE_KEYS.LABELS);
      if (rawLabels && tx.source_account) {
        const labels = JSON.parse(rawLabels);
        if (labels[tx.source_account] || labels[tx.account]) {
          relationship = 0.9;
        }
      }
    } catch {}

    // Check if it's bidirectional or has high volume from transaction details if available
    if (tx.relationshipScore !== undefined) {
      relationship = tx.relationshipScore;
    } else if (tx.isBidirectional) {
      relationship = 0.85;
    }

    // 5. Timing pattern feature (Urgency/Business Hours vs Out of hours)
    // Peak hours (09:00 - 18:00) get slightly higher default score, or vice-versa
    const date = tx.created_at ? new Date(tx.created_at) : new Date();
    const hour = date.getHours();
    const isBusinessHours = hour >= 9 && hour <= 18;
    const timing = isBusinessHours ? 0.8 : 0.4;

    return { amount, fee, operations, relationship, timing };
  }

  /**
   * Score a single transaction
   */
  public scoreTransaction(tx: any): PriorityScoreDetails {
    const hash = tx.hash || tx.id;
    
    // Check if user has explicitly overridden the priority
    const userOverride = this.overrides[hash];

    const features = this.extractFeatures(tx);
    
    // Compute weighted score (0 to 100)
    let rawScore = 
      features.amount * this.weights.amountWeight +
      features.fee * this.weights.feeWeight +
      features.operations * this.weights.operationsWeight +
      features.relationship * this.weights.relationshipWeight +
      features.timing * this.weights.timingWeight +
      this.weights.bias;

    // Constrain score between 0 and 100
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    
    let level: PriorityLevel = 'Medium';
    if (score < 35) {
      level = 'Low';
    } else if (score >= 70) {
      level = 'High';
    }

    if (userOverride) {
      // Keep user's override level, but adjust score to fit the range if needed
      let adjustedScore = score;
      if (userOverride === 'Low' && score >= 35) adjustedScore = 20;
      if (userOverride === 'Medium' && (score < 35 || score >= 70)) adjustedScore = 50;
      if (userOverride === 'High' && score < 70) adjustedScore = 85;

      return {
        score: adjustedScore,
        level: userOverride,
        features,
        isSuggested: false,
      };
    }

    return {
      score,
      level,
      features,
      isSuggested: true,
    };
  }

  /**
   * Learn from a user correction
   */
  public updatePriority(tx: any, targetLevel: PriorityLevel) {
    const hash = tx.hash || tx.id;
    this.overrides[hash] = targetLevel;

    const details = this.scoreTransaction(tx);
    const features = details.features;

    // Define target score for training: Low = 15, Medium = 50, High = 85
    let targetScore = 50;
    if (targetLevel === 'Low') targetScore = 15;
    if (targetLevel === 'High') targetScore = 85;

    const error = targetScore - details.score;

    // Simple perceptron weight update rule: W = W + LR * Error * Feature
    // We normalize updates to prevent weights from blowing up
    const featureSum = Object.values(features).reduce((a, b) => a + b, 0) || 1;
    
    this.weights.amountWeight += LEARNING_RATE * error * (features.amount / featureSum);
    this.weights.feeWeight += LEARNING_RATE * error * (features.fee / featureSum);
    this.weights.operationsWeight += LEARNING_RATE * error * (features.operations / featureSum);
    this.weights.relationshipWeight += LEARNING_RATE * error * (features.relationship / featureSum);
    this.weights.timingWeight += LEARNING_RATE * error * (features.timing / featureSum);
    this.weights.bias += LEARNING_RATE * error * 0.1;

    // Keep weights within reasonable bounds (0 to 100)
    this.weights.amountWeight = Math.max(0, Math.min(100, this.weights.amountWeight));
    this.weights.feeWeight = Math.max(0, Math.min(100, this.weights.feeWeight));
    this.weights.operationsWeight = Math.max(0, Math.min(100, this.weights.operationsWeight));
    this.weights.relationshipWeight = Math.max(0, Math.min(100, this.weights.relationshipWeight));
    this.weights.timingWeight = Math.max(0, Math.min(100, this.weights.timingWeight));
    this.weights.bias = Math.max(-50, Math.min(50, this.weights.bias));

    // Normalize weights to sum to approximately 100
    const totalWeight = 
      this.weights.amountWeight + 
      this.weights.feeWeight + 
      this.weights.operationsWeight + 
      this.weights.relationshipWeight + 
      this.weights.timingWeight;

    if (totalWeight > 0) {
      const scale = 100 / totalWeight;
      this.weights.amountWeight *= scale;
      this.weights.feeWeight *= scale;
      this.weights.operationsWeight *= scale;
      this.weights.relationshipWeight *= scale;
      this.weights.timingWeight *= scale;
    }

    this.saveToStorage();
  }
}

export const priorityScoringService = new PriorityScoringService();
