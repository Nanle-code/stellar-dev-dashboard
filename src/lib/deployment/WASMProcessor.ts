import { xdr } from '@stellar/stellar-sdk';
export class WASMProcessor {
  static async parseFile(file) { return new Uint8Array(await file.arrayBuffer()); }
  static toScVal(value, type) {
    if (type === 'int') return xdr.ScVal.scvI64(BigInt(value || '0'));
    if (type === 'bool') return xdr.ScVal.scvBool(value === 'true');
    return xdr.ScVal.scvString(String(value ?? ''));
  }
}
