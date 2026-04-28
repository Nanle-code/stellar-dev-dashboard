export class CostEstimator {
  static async estimate(wasmBytes: Uint8Array, constructorArgs: any[]) {
    const kb = Math.ceil(wasmBytes.length / 1024);
    return { estimatedFeeStroops: 100000 + kb * 2000 + constructorArgs.length * 1500, footprintKb: kb, argCount: constructorArgs.length };
  }
}
