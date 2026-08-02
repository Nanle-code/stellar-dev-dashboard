import * as tf from '@tensorflow/tfjs';
import type { AccountModel } from './types';

export class AccountDigitalTwin {
  private model: tf.LayersModel | null = null;
  private account: AccountModel;

  constructor(account: AccountModel) {
    this.account = account;
  }

  async buildModel(): Promise<void> {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [6], units: 12, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' }),
      ],
    });
    this.model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
  }

  getFeatures(): tf.Tensor {
    return tf.tensor2d([[
      this.account.averageBalance / 1_000_000,
      this.account.transactionFrequency / 100,
      this.account.preferredTokens.length / 10,
      this.account.contractInteractions.length / 50,
      this.account.riskTolerance,
      (Date.now() - this.account.lastActivity) / 86_400_000,
    ]]);
  }

  async predictRiskScore(): Promise<number> {
    if (!this.model) await this.buildModel();
    const features = this.getFeatures();
    const prediction = this.model!.predict(features) as tf.Tensor;
    const values = await prediction.data();
    features.dispose();
    prediction.dispose();
    return Math.round(values[2] * 100) / 100;
  }

  async predictBalanceImpact(amount: number): Promise<number> {
    const volatility = this.account.riskTolerance * 0.1;
    const frequencyFactor = Math.min(this.account.transactionFrequency / 50, 1);
    const estimatedImpact = amount * (1 - volatility * frequencyFactor);
    return Math.round(estimatedImpact * 100) / 100;
  }

  getAccount(): AccountModel {
    return { ...this.account };
  }
}
