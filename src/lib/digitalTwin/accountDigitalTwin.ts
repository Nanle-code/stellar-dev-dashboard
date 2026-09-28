import type { LayersModel, Tensor } from '@tensorflow/tfjs';
import { loadTfjs, type TfjsModule } from '../mlRuntime';
import type { AccountModel } from './types';

/**
 * Digital twin of a Stellar account, backed by a small TensorFlow.js model.
 *
 * TensorFlow.js is loaded on demand through the `mlRuntime` facade (#969) so
 * that importing this module does not drag the ML runtime into the initial
 * bundle. The first call that needs the runtime awaits `loadTfjs()`; afterwards
 * the runtime is cached both here and in the facade.
 */
export class AccountDigitalTwin {
  private model: LayersModel | null = null;
  private tf: TfjsModule | null = null;
  private account: AccountModel;

  constructor(account: AccountModel) {
    this.account = account;
  }

  /** Load the ML runtime if needed and remember it for sync tensor work. */
  private async runtime(): Promise<TfjsModule> {
    if (!this.tf) {
      this.tf = await loadTfjs();
    }
    return this.tf;
  }

  /** The runtime, once `runtime()`/`buildModel()` has resolved. */
  private requireRuntime(): TfjsModule {
    if (!this.tf) {
      throw new Error(
        'TensorFlow.js runtime is not loaded yet — await buildModel() before reading features'
      );
    }
    return this.tf;
  }

  async buildModel(): Promise<void> {
    const tf = await this.runtime();
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

  /** Feature vector for the account. Requires the runtime to be loaded. */
  getFeatures(): Tensor {
    const tf = this.requireRuntime();
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
    const prediction = this.model!.predict(features) as Tensor;
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
