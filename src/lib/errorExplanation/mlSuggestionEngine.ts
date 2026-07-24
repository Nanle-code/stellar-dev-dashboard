/**
 * ML-Enhanced Context-Specific Suggestion Engine
 * Uses TensorFlow.js to provide context-aware error explanations and solutions
 */

import * as tf from '@tensorflow/tfjs';
import { getErrorExplanation, ErrorExplanation } from './errorDatabase';

export interface ErrorContext {
  errorCode: string;
  operation: string;
  component: string;
  userAction: string;
  timestamp: number;
  previousErrors: string[];
  accountState?: {
    balance: number;
    sequenceNumber: number;
    subentries: number;
  };
  networkState?: {
    isOnline: boolean;
    latency: number;
  };
}

export interface SuggestionResult {
  explanation: ErrorExplanation;
  contextAwareSuggestions: string[];
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  estimatedResolutionTime: number; // in minutes
  relatedErrors: string[];
}

export interface UserFeedback {
  errorId: string;
  helpful: boolean;
  rating: number; // 1-5
  suggestionUsed: string;
  timestamp: number;
}

class MLSuggestionEngine {
  private model: tf.LayersModel | null = null;
  private feedbackHistory: UserFeedback[] = [];
  private contextPatterns: Map<string, number[]> = new Map();
  private isInitialized = false;

  /**
   * Initialize the ML model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try to load existing model from IndexedDB
      this.model = await tf.loadLayersModel('indexeddb://stellar-error-suggestion-model');
      this.model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
    } catch {
      // Create new model if none exists
      this.model = this.createModel();
      await this.saveModel();
    }

    this.loadFeedbackHistory();
    this.isInitialized = true;
  }

  /**
   * Create the suggestion model architecture
   */
  private createModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer: error code (one-hot encoded), context features
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [20] // 20 input features
    }));
    
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dropout({ rate: 0.1 }));
    
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    
    // Output layer: suggestion priority scores
    model.add(tf.layers.dense({
      units: 3, // high, medium, low priority
      activation: 'softmax'
    }));

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Extract features from error context
   */
  private extractFeatures(context: ErrorContext): number[] {
    const features: number[] = [];
    
    // Error code hash (first 10 features)
    const errorCodeHash = this.hashString(context.errorCode);
    for (let i = 0; i < 10; i++) {
      features.push((errorCodeHash >> (i * 3)) & 0x7);
    }
    
    // Operation type (encoded)
    const operationHash = this.hashString(context.operation);
    features.push((operationHash % 10) / 10);
    
    // Component (encoded)
    const componentHash = this.hashString(context.component);
    features.push((componentHash % 10) / 10);
    
    // Time of day (normalized 0-1)
    const hour = new Date(context.timestamp).getHours();
    features.push(hour / 24);
    
    // Previous error count (normalized)
    features.push(Math.min(context.previousErrors.length, 10) / 10);
    
    // Account balance (log normalized)
    if (context.accountState) {
      features.push(Math.log1p(context.accountState.balance) / 20);
    } else {
      features.push(0);
    }
    
    // Network latency (normalized)
    if (context.networkState) {
      features.push(Math.min(context.networkState.latency, 5000) / 5000);
    } else {
      features.push(0);
    }
    
    // Online status
    features.push(context.networkState?.isOnline ? 1 : 0);
    
    // Error frequency in context (normalized)
    const errorFrequency = this.getErrorFrequency(context.errorCode);
    features.push(Math.min(errorFrequency, 10) / 10);
    
    // Recent success rate (normalized)
    const successRate = this.getRecentSuccessRate();
    features.push(successRate);
    
    return features;
  }

  /**
   * Hash string to number for feature encoding
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get error frequency in recent history
   */
  private getErrorFrequency(errorCode: string): number {
    const pattern = this.contextPatterns.get(errorCode) || [];
    const recent = pattern.filter(t => Date.now() - t < 3600000); // Last hour
    return recent.length;
  }

  /**
   * Get recent success rate for similar errors
   */
  private getRecentSuccessRate(): number {
    if (this.feedbackHistory.length === 0) return 0.5;
    
    const recent = this.feedbackHistory.filter(
      f => Date.now() - f.timestamp < 86400000 // Last 24 hours
    );
    
    if (recent.length === 0) return 0.5;
    
    const helpfulCount = recent.filter(f => f.helpful).length;
    return helpfulCount / recent.length;
  }

  /**
   * Generate context-aware suggestions
   */
  async generateSuggestions(context: ErrorContext): Promise<SuggestionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const explanation = getErrorExplanation(context.errorCode);
    if (!explanation) {
      return this.generateFallbackSuggestion(context);
    }

    const features = this.extractFeatures(context);
    const inputTensor = tf.tensor2d([features]);
    
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let confidence = 0.5;

    try {
      const prediction = this.model!.predict(inputTensor) as tf.Tensor;
      const probabilities = await prediction.data();
      
      const maxIdx = probabilities.indexOf(Math.max(...probabilities));
      const priorities: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
      priority = priorities[maxIdx];
      confidence = probabilities[maxIdx];
      
      prediction.dispose();
    } catch {
      // Fallback to rule-based priority
      priority = this.calculateRuleBasedPriority(explanation, context);
    }

    inputTensor.dispose();

    // Generate context-aware suggestions
    const contextAwareSuggestions = this.enhanceSuggestions(
      explanation.suggestedSolutions,
      context,
      explanation
    );

    // Track error occurrence
    this.trackErrorOccurrence(context.errorCode);

    return {
      explanation,
      contextAwareSuggestions,
      confidence,
      priority,
      estimatedResolutionTime: this.estimateResolutionTime(explanation, context),
      relatedErrors: this.findRelatedErrors(context)
    };
  }

  /**
   * Enhance suggestions with context-specific information
   */
  private enhanceSuggestions(
    baseSuggestions: string[],
    context: ErrorContext,
    explanation: ErrorExplanation
  ): string[] {
    const enhanced = [...baseSuggestions];

    // Add context-specific suggestions
    if (context.accountState) {
      if (explanation.code === 'tx_insufficient_balance' || explanation.code === 'insufficient balance') {
        const balanceXLM = context.accountState.balance / 10000000; // Convert stroops to XLM
        enhanced.unshift(`Your current balance is ${balanceXLM.toFixed(2)} XLM. You need at least 2 XLM minimum reserve.`);
      }
      
      if (explanation.code === 'tx_bad_seq') {
        enhanced.unshift(`Your current sequence number is ${context.accountState.sequenceNumber}. Ensure your transaction uses sequence ${context.accountState.sequenceNumber + 1}.`);
      }
    }

    if (context.networkState) {
      if (!context.networkState.isOnline) {
        enhanced.unshift('You appear to be offline. Check your internet connection.');
      }
      
      if (context.networkState.latency > 2000) {
        enhanced.unshift('Network latency is high. Consider waiting for better network conditions.');
      }
    }

    // Add operation-specific suggestions
    if (context.operation === 'payment') {
      enhanced.push('Double-check the destination address before retrying.');
    }
    
    if (context.operation === 'create_account') {
      enhanced.push('Ensure you have at least 2 XLM to fund the new account (1 XLM for creation + 1 XLM reserve).');
    }

    // Add time-based suggestions
    const hour = new Date(context.timestamp).getHours();
    if (hour >= 0 && hour < 6) {
      enhanced.push('Network activity is typically lower during off-peak hours (midnight-6AM UTC).');
    }

    return enhanced;
  }

  /**
   * Calculate rule-based priority as fallback
   */
  private calculateRuleBasedPriority(
    explanation: ErrorExplanation,
    context: ErrorContext
  ): 'high' | 'medium' | 'low' {
    if (explanation.severity === 'critical') return 'high';
    if (explanation.severity === 'high') return 'high';
    if (explanation.severity === 'medium') return 'medium';
    
    // Check for recurring errors
    const frequency = this.getErrorFrequency(context.errorCode);
    if (frequency > 3) return 'high';
    if (frequency > 1) return 'medium';
    
    return 'low';
  }

  /**
   * Estimate resolution time based on error type and context
   */
  private estimateResolutionTime(
    explanation: ErrorExplanation,
    context: ErrorContext
  ): number {
    // Base times in minutes
    const baseTimes: Record<string, number> = {
      'network': 5,
      'rate_limit': 2,
      'authentication': 1,
      'validation': 2,
      'stellar': 10,
      'permission': 30
    };

    let baseTime = baseTimes[explanation.category] || 5;

    // Adjust based on severity
    if (explanation.severity === 'critical') baseTime *= 3;
    if (explanation.severity === 'high') baseTime *= 2;

    // Adjust based on retryability
    if (!explanation.retryable) baseTime *= 1.5;

    // Adjust based on network conditions
    if (context.networkState && context.networkState.latency > 2000) {
      baseTime *= 1.5;
    }

    return Math.round(baseTime);
  }

  /**
   * Find related errors based on context
   */
  private findRelatedErrors(context: ErrorContext): string[] {
    const related: string[] = [];
    
    // Find errors that often occur together
    const commonPairs: Record<string, string[]> = {
      'tx_insufficient_balance': ['op_underfunded', 'op_low_reserve'],
      'tx_bad_seq': ['tx_failed', '409'],
      'op_no_trust': ['op_src_not_authorized'],
      'network_error': ['timeout', '502', '503'],
      'rate limit': ['429']
    };

    if (commonPairs[context.errorCode]) {
      related.push(...commonPairs[context.errorCode]);
    }

    return related;
  }

  /**
   * Generate fallback suggestion when error not in database
   */
  private generateFallbackSuggestion(context: ErrorContext): SuggestionResult {
    const fallbackExplanation: ErrorExplanation = {
      code: context.errorCode,
      category: 'unknown',
      title: 'Unknown Error',
      plainExplanation: `An error occurred with code: ${context.errorCode}. This error is not in our database.`,
      technicalDetails: 'No technical details available for this error code.',
      commonCauses: ['Unknown error type', 'Custom application error'],
      suggestedSolutions: [
        'Check the Stellar documentation for this error',
        'Contact support with the error code',
        'Try refreshing the page and retrying'
      ],
      relatedDocs: ['https://developers.stellar.org/docs/support'],
      severity: 'medium',
      retryable: true
    };

    return {
      explanation: fallbackExplanation,
      contextAwareSuggestions: fallbackExplanation.suggestedSolutions,
      confidence: 0.3,
      priority: 'medium',
      estimatedResolutionTime: 10,
      relatedErrors: []
    };
  }

  /**
   * Track error occurrence for pattern learning
   */
  private trackErrorOccurrence(errorCode: string): void {
    const pattern = this.contextPatterns.get(errorCode) || [];
    pattern.push(Date.now());
    
    // Keep only last 100 occurrences
    if (pattern.length > 100) {
      pattern.shift();
    }
    
    this.contextPatterns.set(errorCode, pattern);
  }

  /**
   * Record user feedback for continuous learning
   */
  recordFeedback(feedback: UserFeedback): void {
    this.feedbackHistory.push(feedback);
    
    // Keep only last 1000 feedback entries
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory.shift();
    }
    
    this.saveFeedbackHistory();
    
    // Retrain model periodically
    if (this.feedbackHistory.length % 50 === 0) {
      this.retrainModel();
    }
  }

  /**
   * Load feedback history from localStorage
   */
  private loadFeedbackHistory(): void {
    try {
      const stored = localStorage.getItem('stellar-error-feedback');
      if (stored) {
        this.feedbackHistory = JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Save feedback history to localStorage
   */
  private saveFeedbackHistory(): void {
    try {
      localStorage.setItem('stellar-error-feedback', JSON.stringify(this.feedbackHistory));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Retrain model with new feedback data
   */
  private async retrainModel(): Promise<void> {
    if (!this.model || this.feedbackHistory.length < 10) return;

    try {
      // Prepare training data from feedback
      // This is a simplified version - in production, you'd want more sophisticated training
      const trainingData = this.prepareTrainingData();
      
      if (trainingData.features.length > 0) {
        const xs = tf.tensor2d(trainingData.features);
        const ys = tf.tensor2d(trainingData.labels);
        
        await this.model.fit(xs, ys, {
          epochs: 5,
          batchSize: 16,
          shuffle: true,
          verbose: 0
        });
        
        xs.dispose();
        ys.dispose();
        
        await this.saveModel();
      }
    } catch (error) {
      console.error('Failed to retrain suggestion model:', error);
    }
  }

  /**
   * Prepare training data from feedback history
   */
  private prepareTrainingData(): { features: number[][]; labels: number[][] } {
    // Simplified training data preparation
    // In production, this would be more sophisticated
    const features: number[][] = [];
    const labels: number[][] = [];
    
    this.feedbackHistory.forEach(feedback => {
      // Create synthetic features based on feedback
      const feature = new Array(20).fill(0);
      feature[0] = feedback.rating / 5; // 0-1 normalized
      
      features.push(feature);
      
      // Create label based on helpfulness
      if (feedback.helpful) {
        labels.push([1, 0, 0]); // High priority
      } else {
        labels.push([0, 0, 1]); // Low priority
      }
    });
    
    return { features, labels };
  }

  /**
   * Save model to IndexedDB
   */
  private async saveModel(): Promise<void> {
    if (!this.model) return;
    
    try {
      await this.model.save('indexeddb://stellar-error-suggestion-model');
    } catch (error) {
      console.error('Failed to save suggestion model:', error);
    }
  }

  /**
   * Get model statistics
   */
  getStats(): {
    isInitialized: boolean;
    feedbackCount: number;
    trackedErrors: number;
    recentSuccessRate: number;
  } {
    return {
      isInitialized: this.isInitialized,
      feedbackCount: this.feedbackHistory.length,
      trackedErrors: this.contextPatterns.size,
      recentSuccessRate: this.getRecentSuccessRate()
    };
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.feedbackHistory = [];
    this.contextPatterns.clear();
    this.model = null;
    this.isInitialized = false;
    
    try {
      localStorage.removeItem('stellar-error-feedback');
      // Note: IndexedDB cleanup would require additional code
    } catch {
      // Ignore errors
    }
  }
}

// Singleton instance
let suggestionEngineInstance: MLSuggestionEngine | null = null;

/**
 * Get the suggestion engine singleton
 */
export function getSuggestionEngine(): MLSuggestionEngine {
  if (!suggestionEngineInstance) {
    suggestionEngineInstance = new MLSuggestionEngine();
  }
  return suggestionEngineInstance;
}

/**
 * Generate suggestions for an error (convenience function)
 */
export async function explainError(context: ErrorContext): Promise<SuggestionResult> {
  const engine = getSuggestionEngine();
  return await engine.generateSuggestions(context);
}
