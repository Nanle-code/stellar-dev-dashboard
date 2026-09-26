/**
 * Wasm-hash extraction for contract-instance ledger entries (#980).
 *
 * The dashboard can read a contract's instance entry via Soroban RPC, but the
 * XDR object shape differs across `@stellar/stellar-sdk` versions and the
 * entry may be absent offline. This helper walks the known paths defensively
 * and returns an empty string when no hash can be read, so callers can always
 * fall back to a user-supplied hash.
 */

/** Convert a byte-like value into a lowercase hex string. */
function toHex(value: unknown): string {
  if (!value) return ''

  if (typeof value === 'string') return value.replace(/^0x/i, '').toLowerCase()

  if (value instanceof Uint8Array) {
    return Array.from(value)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  if (Array.isArray(value)) {
    return value
      .map((byte) => Number(byte).toString(16).padStart(2, '0'))
      .join('')
  }

  const maybeHex = (value as { toString?: (encoding?: string) => string }).toString
  if (typeof maybeHex === 'function') {
    try {
      const text = maybeHex('hex')
      if (typeof text === 'string' && /^[0-9a-f]+$/i.test(text)) return text.toLowerCase()
    } catch {
      // not a buffer-like value
    }
  }

  return ''
}

/** Normalise a Wasm hash string for comparison (trim, strip 0x, lowercase). */
export function normalizeWasmHash(value: unknown): string {
  if (typeof value !== 'string') return toHex(value)
  return value.trim().replace(/^0x/i, '').toLowerCase()
}

/**
 * Extract the Wasm hash from a Soroban contract-instance ledger entry.
 *
 * Accepts either a `LedgerEntryResult` (`{ val }`) or the entry data directly,
 * and returns `''` when the shape is unknown or the contract is a built-in
 * (Stellar Asset Contract) instance.
 */
export function extractWasmHashFromLedgerEntry(entry: unknown): string {
  try {
    const record = entry as Record<string, unknown> | null | undefined
    if (!record) return ''

    const entryData = (record.val ?? record) as Record<string, unknown>
    const contractData = typeof entryData.contractData === 'function' ? entryData.contractData() : null
    const scVal = contractData && typeof contractData.val === 'function' ? contractData.val() : null
    const instance = scVal && typeof scVal.value === 'function' ? scVal.value() : scVal
    const executable = instance && typeof (instance as Record<string, unknown>).executable === 'function'
      ? (instance as { executable: () => unknown }).executable()
      : null

    if (!executable) return ''

    const exec = executable as Record<string, unknown>
    const wasm = typeof exec.wasm === 'function' ? (exec.wasm as () => unknown)() : exec.wasm

    if (wasm && typeof (wasm as Record<string, unknown>).hash === 'function') {
      return normalizeWasmHash((wasm as { hash: () => unknown }).hash())
    }
    if (wasm !== undefined && wasm !== null) return normalizeWasmHash(wasm)

    // Some SDK versions expose the hash directly on the executable.
    const directHash = typeof exec.wasmHash === 'function'
      ? (exec.wasmHash as () => unknown)()
      : exec.wasmHash
    return normalizeWasmHash(directHash)
  } catch {
    return ''
  }
}
