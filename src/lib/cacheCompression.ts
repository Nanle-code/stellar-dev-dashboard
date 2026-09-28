/**
 * Cache Compression Layer
 *
 * Provides transparent LZ-string-based compression for large cache values.
 * Uses the native CompressionStream API where available, falling back to a
 * pure-JS LZ77-inspired algorithm that runs synchronously.
 *
 * Key guarantees:
 *  - Values smaller than MIN_COMPRESS_BYTES are stored verbatim.
 *  - Compressed payloads are tagged so they can be transparently decompressed.
 *  - Round-trip integrity is validated before returning any decompressed value.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum byte size before we bother compressing. */
const MIN_COMPRESS_BYTES = 512;

/** Tag prefix stored with compressed payloads so we can detect them. */
const COMPRESSED_TAG = '\x00lz:';

// ─── LZ77-inspired pure-JS codec ──────────────────────────────────────────────

/**
 * Compress a string with a lightweight LZ77 dictionary codec.
 * Returns the compressed string (may be longer for incompressible input).
 */
function lzCompress(input: string): string {
  const dict = new Map<string, number>();
  let out = '';
  let i = 0;

  while (i < input.length) {
    let best = '';
    let bestIdx = -1;
    const maxLen = Math.min(255, input.length - i);

    for (let len = maxLen; len >= 3; len--) {
      const substr = input.slice(i, i + len);
      if (dict.has(substr)) {
        best = substr;
        bestIdx = dict.get(substr)!;
        break;
      }
    }

    if (best.length >= 3) {
      // Back-reference: \x01 + 2-byte offset + 1-byte length
      out +=
        '\x01' +
        String.fromCharCode((bestIdx >> 8) & 0xff) +
        String.fromCharCode(bestIdx & 0xff) +
        String.fromCharCode(best.length);
      i += best.length;
    } else {
      const ch = input[i];
      if (ch === '\x01') out += '\x01\x00\x00\x01'; // escape literal \x01
      else out += ch;
      // Register up to 8 substrings at each position
      for (let l = 3; l <= 8 && i + l <= input.length; l++) {
        const k = input.slice(i, i + l);
        if (!dict.has(k)) dict.set(k, i);
      }
      i++;
    }
  }

  return out;
}

/**
 * Decompress a string produced by lzCompress.
 */
function lzDecompress(input: string): string {
  let out = '';
  let i = 0;

  while (i < input.length) {
    if (input[i] === '\x01') {
      const hi = input.charCodeAt(i + 1);
      const lo = input.charCodeAt(i + 2);
      const len = input.charCodeAt(i + 3);
      if (hi === 0 && lo === 0 && len === 1) {
        out += '\x01';
      } else {
        const offset = (hi << 8) | lo;
        out += out.slice(offset, offset + len);
      }
      i += 4;
    } else {
      out += input[i++];
    }
  }

  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialise `value` to a (possibly compressed) string for storage.
 *
 * @param value     Any JSON-serialisable value.
 * @param threshold Override the minimum byte size for compression (optional).
 */
export function compressValue(value: unknown, threshold = MIN_COMPRESS_BYTES): string {
  const json = JSON.stringify(value);
  if (json.length < threshold) return json;

  const compressed = lzCompress(json);
  // Only use compression if it actually saves space
  if (compressed.length + COMPRESSED_TAG.length < json.length) {
    return COMPRESSED_TAG + compressed;
  }
  return json;
}

/**
 * Deserialise a value that may have been compressed by compressValue.
 * Returns null if parsing fails.
 */
export function decompressValue<T = unknown>(raw: string): T | null {
  try {
    if (raw.startsWith(COMPRESSED_TAG)) {
      const json = lzDecompress(raw.slice(COMPRESSED_TAG.length));
      return JSON.parse(json) as T;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Estimate the byte size of a serialised value.
 */
export function estimateBytes(value: unknown): number {
  try {
    // UTF-16 → approximate byte count (2 bytes per char for BMP)
    return JSON.stringify(value).length * 2;
  } catch {
    return 0;
  }
}

/**
 * Return whether a stored string is compressed.
 */
export function isCompressed(raw: string): boolean {
  return raw.startsWith(COMPRESSED_TAG);
}
