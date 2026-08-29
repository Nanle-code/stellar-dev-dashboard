import { stroopsToXLM, xlmToStroops, formatStroops, parseStroops } from '../../utils/stroopConversion.js';

export interface CostEstimate {
  estimatedFeeStroops: number;
  footprintKb: number;
  argCount: number;
  baseStorageFee: number;
  perKbFee: number;
  perArgFee: number;
  totalWithMargin: number;
  estimatedUsd?: number;
}

export class CostEstimator {
  private static readonly BASE_FEE_STROOPS = 100000;
  private static readonly PER_KB_FEE_STROOPS = 2000;
  private static readonly PER_ARG_FEE_STROOPS = 1500;
  private static readonly MARGIN_PERCENTAGE = 0.15;

  static async estimate(
    wasmBytes: Uint8Array,
    constructorArgs: any[]
  ): Promise<CostEstimate> {
    const kb = Math.ceil(wasmBytes.length / 1024);
    const validArgCount = constructorArgs.filter((arg) => {
      if (!arg) return false;
      if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
        return String(arg).trim() !== '';
      }

      if (typeof arg === 'object' && 'value' in arg) {
        return String((arg as { value?: unknown }).value ?? '').trim() !== '';
      }

      return String(arg).trim() !== '';
    }).length;

    const baseStorageFee = CostEstimator.BASE_FEE_STROOPS;
    const perKbFee = kb * CostEstimator.PER_KB_FEE_STROOPS;
    const perArgFee = validArgCount * CostEstimator.PER_ARG_FEE_STROOPS;

    const subtotal = baseStorageFee + perKbFee + perArgFee;
    const marginFee = Math.ceil(subtotal * CostEstimator.MARGIN_PERCENTAGE);
    const estimatedFeeStroops = subtotal + marginFee;

    const estimatedUsd = Number(stroopsToXLM(estimatedFeeStroops)) * 0.10;

    return {
      estimatedFeeStroops,
      footprintKb: kb,
      argCount: validArgCount,
      baseStorageFee,
      perKbFee,
      perArgFee,
      totalWithMargin: estimatedFeeStroops,
      estimatedUsd,
    };
  }

  static formatStroops(stroops: number): string {
    return formatStroops(BigInt(stroops));
  }

  static parseStroops(stroopsStr: string): number {
    return Number(parseStroops(stroopsStr));
  }
}
