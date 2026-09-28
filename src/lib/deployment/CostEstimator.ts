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
  // Estimated fee parameters for Soroban contracts
  private static readonly BASE_FEE_STROOPS = 100000; // 0.01 XLM
  private static readonly PER_KB_FEE_STROOPS = 2000; // Fee per KB of WASM
  private static readonly PER_ARG_FEE_STROOPS = 1500; // Fee per constructor argument
  private static readonly MARGIN_PERCENTAGE = 0.15; // 15% safety margin
  private static readonly XLM_RATE_STROOPS = 10000000; // 1 XLM = 10,000,000 stroops

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

    // Estimate USD value (assuming 1 XLM ≈ $0.10, but this should come from price feed)
    const estimatedUsd = (estimatedFeeStroops / CostEstimator.XLM_RATE_STROOPS) * 0.10;

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
    const xlm = stroops / CostEstimator.XLM_RATE_STROOPS;
    return `${xlm.toFixed(7)} XLM (${stroops.toLocaleString()} stroops)`;
  }

  static parseStroops(stroopsStr: string): number {
    const match = stroopsStr.match(/(\d+(?:\.\d+)?)\s*(?:XLM)?/);
    if (!match) {
      throw new Error('Invalid stroops format');
    }
    const xlm = parseFloat(match[1]);
    return Math.floor(xlm * CostEstimator.XLM_RATE_STROOPS);
  }
}
