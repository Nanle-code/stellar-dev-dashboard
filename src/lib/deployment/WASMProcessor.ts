import { xdr } from '@stellar/stellar-sdk';

export const MAX_WASM_BYTES = 20 * 1024 * 1024;

export interface WasmFileMetadata {
  name: string;
  sizeBytes: number;
  sizeKb: number;
  sizeMb: number;
  mimeType: string;
  lastModified: number;
  artifactHash: string;
}

export interface ScValType {
  type: 'int' | 'bool' | 'string' | 'address' | 'bytes' | 'vec' | 'map';
  value: any;
}

export class WASMProcessor {
  static async parseFile(file: File) {
    return new Uint8Array(await file.arrayBuffer());
  }

  static async inspectFile(file: File): Promise<WasmFileMetadata & { bytes: Uint8Array }> {
    const bytes = await WASMProcessor.parseFile(file);
    const artifactHash = await WASMProcessor.hashBytes(bytes);
    const sizeBytes = bytes.length;

    return {
      bytes,
      name: file.name,
      sizeBytes,
      sizeKb: Math.ceil(sizeBytes / 1024),
      sizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(2)),
      mimeType: file.type || 'application/wasm',
      lastModified: file.lastModified || Date.now(),
      artifactHash,
    };
  }

  static async hashBytes(bytes: Uint8Array): Promise<string> {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    if (typeof crypto !== 'undefined' && crypto?.subtle?.digest) {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }

    // Fallback for environments without Web Crypto. This keeps receipts stable in tests.
    let hash = 0x811c9dc5;
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  static toScVal(value, type) {
    if (type === 'int') return xdr.ScVal.scvI64(xdr.Int64.fromString(String(value || '0')));
    if (type === 'bool') return xdr.ScVal.scvBool(value === 'true' || value === true);
    if (type === 'bytes') {
      const normalized = String(value ?? '').replace(/^0x/, '');
      const bytePairs = normalized.match(/.{1,2}/g) || [];
      return xdr.ScVal.scvBytes(Uint8Array.from(bytePairs.map((pair) => parseInt(pair, 16))));
    }
    return xdr.ScVal.scvString(String(value ?? ''));
  }
}
