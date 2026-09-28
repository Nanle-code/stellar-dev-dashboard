/**
 * Smart wallet account support for Soroban / Protocol 21+.
 *
 * Passkey smart wallets are contract accounts identified by a C-address
 * (contract ID).  The dashboard previously treated C-addresses only as
 * read-only contract data sources.  This module adds:
 *
 *  - SmartWalletAccount — a unified account view that combines on-chain
 *    contract state (via Soroban RPC) with SAC token balances and a
 *    reconstructed auth history from Horizon contract events.
 *
 *  - isSmartWalletContract() — heuristic to detect whether a contract
 *    implements the passkey smart-wallet interface (__check_auth + balance).
 *
 *  - fetchSmartWalletAccount() — loads the account view from chain data.
 *
 *  - fetchSacBalances() — fetches balances of Stellar Asset Contract tokens
 *    held by the smart wallet.
 *
 *  - fetchAuthHistory() — reconstructs recent __check_auth invocations from
 *    Horizon's contract events for the wallet's contract ID.
 *
 *  - signSorobanAuthEntry() — orchestrates the full WebAuthn signing flow
 *    for a single SorobanAuthorizationEntry, from challenge derivation
 *    through assertion to XDR auth-entry construction.
 *
 * Browser / compatibility notes
 * ─────────────────────────────
 * This module is safe to import in all environments; functions that require
 * WebAuthn guard themselves via isPasskeySupported() and throw a
 * PasskeyNotSupportedError on unsupported browsers.
 */

import * as StellarSdk from '@stellar/stellar-sdk'
import { NETWORKS, getSorobanServer, getServer } from '../stellar'
import type { NetworkName } from '../stellar'
import {
  assertPasskey,
  buildSorobanAuthPayload,
  buildSorobanAuthEntry,
  deriveAuthEntryChallenge,
  loadPasskeyCredential,
  type SorobanAuthPayload,
  type PasskeyAssertionResult,
} from './passkey'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SacBalance {
  /** Stellar Asset Contract address (C-address). */
  contractId: string
  /** Human-readable asset code, e.g. "USDC". */
  assetCode: string
  /** Issuer G-address (empty for XLM-SAC). */
  issuer: string
  /** Balance as a decimal string, e.g. "1000.0000000". */
  balance: string
  /** True if this is the native XLM SAC. */
  isNative: boolean
}

export interface AuthHistoryEntry {
  /** Transaction hash. */
  txHash: string
  /** Operation ID. */
  operationId: string
  /** Whether the auth check succeeded. */
  success: boolean
  /** Ledger sequence number. */
  ledger: number
  /** ISO timestamp of the ledger close. */
  closedAt: string
  /** The authorised function that was invoked. */
  functionName?: string
  /** Hex-encoded public key that signed (from the auth payload). */
  signerPublicKey?: string
}

export interface SmartWalletAccount {
  /** Contract address (C-address). */
  contractId: string
  /** Whether the contract implements the passkey smart-wallet interface. */
  isPasskeySmartWallet: boolean
  /** Hex-encoded compressed P-256 public key registered in the contract, if readable. */
  registeredPublicKey?: string
  /** SAC token balances held by this contract account. */
  sacBalances: SacBalance[]
  /** Recent __check_auth history. */
  authHistory: AuthHistoryEntry[]
  /** ISO timestamp of when this view was fetched. */
  fetchedAt: string
  /** Network on which this data was fetched. */
  network: NetworkName
}

export interface SmartWalletSigningRequest {
  /** Base64-encoded SorobanAuthorizationEntry XDR to sign. */
  authEntryXdr: string
  /** Network passphrase (required to derive the challenge). */
  networkPassphrase: string
  /** Base64url credential ID to use; falls back to loadPasskeyCredential(). */
  credentialId?: string
  /** Hex-encoded compressed public key; falls back to loadPasskeyCredential(). */
  compressedPublicKey?: string
  /** Relying party ID; defaults to window.location.hostname. */
  rpId?: string
}

export interface SmartWalletSigningResult {
  /** The raw assertion from the authenticator. */
  assertion: PasskeyAssertionResult
  /** The structured payload for on-chain verification. */
  authPayload: SorobanAuthPayload
  /** Base64-encoded ScMap XDR ready to attach to the auth entry. */
  authEntryXdr: string
}

// ─── Contract detection ───────────────────────────────────────────────────────

/**
 * Heuristic detection of a passkey smart-wallet contract.
 *
 * A passkey smart wallet exposes:
 *   1. A __check_auth function (custom account interface, CAI)
 *   2. A balance or balances function (account abstraction balance view)
 *
 * We inspect the parsed contract spec (if available) rather than calling
 * the contract to avoid unnecessary on-chain reads.
 *
 * @param spec  Contract spec object (StellarSdk.contract.Spec instance or
 *              a plain object with a `funcs()` method).
 * @returns true when both __check_auth and balance indicators are present.
 */
export function isSmartWalletContract(spec: { funcs?: () => unknown[] } | null | undefined): boolean {
  if (!spec || typeof spec.funcs !== 'function') return false

  const functions = spec.funcs()
  if (!Array.isArray(functions)) return false

  const names = new Set(
    functions.map((fn: { name?: () => unknown; toString?: () => string } | unknown) => {
      if (fn && typeof fn === 'object') {
        const named = fn as { name?: () => unknown }
        if (typeof named.name === 'function') return String(named.name())
      }
      return ''
    }),
  )

  return names.has('__check_auth') && (names.has('balance') || names.has('balances'))
}

// ─── SAC balance fetcher ──────────────────────────────────────────────────────

/**
 * Known SAC contract IDs for common assets per network.
 * Populated for testnet; extend for mainnet as needed.
 */
const KNOWN_SAC_CONTRACTS: Record<string, { code: string; issuer: string; isNative: boolean }> = {
  // Testnet XLM-SAC (canonical native asset contract)
  CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYC: {
    code: 'XLM',
    issuer: '',
    isNative: true,
  },
  // Testnet USDC (Circle testnet SAC)
  CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    isNative: false,
  },
}

/**
 * Fetch the SAC (Stellar Asset Contract) token balances held by a smart wallet.
 *
 * For each known SAC, we invoke the `balance(address)` view function via
 * the Soroban RPC simulate path (no fee / gas consumed).
 *
 * @param contractId  C-address of the smart wallet.
 * @param network     Target network.
 */
export async function fetchSacBalances(
  contractId: string,
  network: NetworkName,
): Promise<SacBalance[]> {
  const server = getSorobanServer(network)
  const networkPassphrase = NETWORKS[network]?.passphrase
  if (!networkPassphrase) return []

  const results: SacBalance[] = []

  for (const [sacContractId, info] of Object.entries(KNOWN_SAC_CONTRACTS)) {
    try {
      // Build a balance(address) simulation call
      const contract = new StellarSdk.Contract(sacContractId)
      const addressScVal = StellarSdk.nativeToScVal(contractId, { type: 'address' })
      const operation = contract.call('balance', addressScVal)

      // We need a placeholder source account for simulation; use a deterministic
      // public key derived from the contract ID (never actually submits).
      const placeholderKeypair = StellarSdk.Keypair.fromPublicKey(
        'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      )

      const txBuilder = new StellarSdk.TransactionBuilder(
        { accountId: () => placeholderKeypair.publicKey(), sequenceNumber: () => '0', incrementSequenceNumber: () => {} } as unknown as StellarSdk.Account,
        {
          fee: '100',
          networkPassphrase,
        },
      )
        .addOperation(operation)
        .setTimeout(30)

      const tx = txBuilder.build()
      const simResponse = await server.simulateTransaction(tx)

      if (
        StellarSdk.SorobanRpc.Api.isSimulationSuccess(simResponse) &&
        simResponse.result?.retval
      ) {
        const retval = simResponse.result.retval
        // i128 balance value
        let rawBalance: bigint | null = null
        try {
          const native = StellarSdk.scValToNative(retval)
          rawBalance = typeof native === 'bigint' ? native : BigInt(String(native))
        } catch {
          rawBalance = null
        }

        if (rawBalance !== null) {
          // Format with 7 decimal places (standard Stellar stroops)
          const intPart = rawBalance / 10_000_000n
          const fracPart = rawBalance % 10_000_000n
          const balance = `${intPart}.${String(fracPart).padStart(7, '0')}`

          results.push({
            contractId: sacContractId,
            assetCode: info.code,
            issuer: info.issuer,
            balance,
            isNative: info.isNative,
          })
        }
      }
    } catch {
      // Skip SACs that error (e.g. account has no trustline / no balance entry)
    }
  }

  return results
}

// ─── Auth history fetcher ─────────────────────────────────────────────────────

/**
 * Reconstruct recent __check_auth invocations from Horizon contract events.
 *
 * Horizon exposes contract events under `/accounts/:id/transactions` and
 * `/contracts/:id/events` (the latter is RPC-level).  We use the Horizon
 * transactions-for-account path because it is always available and includes
 * invoke_host_function operations.
 *
 * @param contractId  C-address of the smart wallet (used as Horizon address).
 * @param network     Target network.
 * @param limit       Maximum number of history entries to return.
 */
export async function fetchAuthHistory(
  contractId: string,
  network: NetworkName,
  limit = 20,
): Promise<AuthHistoryEntry[]> {
  const server = getServer(network)

  try {
    // Horizon can query transactions for a contract ID directly
    const txPage = await server
      .transactions()
      .forAccount(contractId)
      .order('desc')
      .limit(limit)
      .call()

    const records = txPage.records ?? []

    return records
      .filter((tx) => tx.successful !== false)
      .map((tx) => ({
        txHash: tx.hash,
        operationId: tx.id,
        success: tx.successful ?? true,
        ledger: tx.ledger_attr ?? 0,
        closedAt: tx.created_at,
        functionName: '__check_auth',
        signerPublicKey: undefined,
      }))
  } catch {
    // Contract account may not have Horizon history yet (newly deployed)
    return []
  }
}

// ─── Full account view loader ─────────────────────────────────────────────────

/**
 * Load a SmartWalletAccount view for the given contract ID.
 *
 * 1. Validates the address is a contract ID.
 * 2. Fetches the contract spec to detect passkey smart-wallet signature.
 * 3. Fetches SAC balances in parallel with auth history.
 *
 * @param contractId  C-address of the smart wallet.
 * @param network     Target network.
 */
export async function fetchSmartWalletAccount(
  contractId: string,
  network: NetworkName,
): Promise<SmartWalletAccount> {
  if (!StellarSdk.StrKey.isValidContract(contractId)) {
    throw new Error(`"${contractId}" is not a valid contract address (C-address expected).`)
  }

  // Try to detect the passkey smart-wallet interface from the contract spec
  let isPasskeySmartWallet = false
  let registeredPublicKey: string | undefined

  try {
    const server = getSorobanServer(network)
    const networkPassphrase = NETWORKS[network]?.passphrase ?? ''
    const rpcUrl = NETWORKS[network]?.sorobanUrl ?? ''
    const allowHttp = rpcUrl.startsWith('http://')

    const client = await StellarSdk.contract.Client.from({
      contractId,
      rpcUrl,
      networkPassphrase,
      allowHttp,
    })

    if (client?.spec) {
      isPasskeySmartWallet = isSmartWalletContract(client.spec)

      // Attempt to read the registered public key from contract storage
      // (many implementations expose `get_pk()` or store it as instance data)
      try {
        const contract = new StellarSdk.Contract(contractId)
        const getPkOp = contract.call('get_pk')
        const placeholderAccount = {
          accountId: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
          sequenceNumber: () => '0',
          incrementSequenceNumber: () => {},
        } as unknown as StellarSdk.Account

        const tx = new StellarSdk.TransactionBuilder(placeholderAccount, {
          fee: '100',
          networkPassphrase,
        })
          .addOperation(getPkOp)
          .setTimeout(30)
          .build()

        const simResp = await server.simulateTransaction(tx)
        if (
          StellarSdk.SorobanRpc.Api.isSimulationSuccess(simResp) &&
          simResp.result?.retval
        ) {
          const native = StellarSdk.scValToNative(simResp.result.retval)
          if (native instanceof Uint8Array && native.length === 33) {
            registeredPublicKey = Array.from(native)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
          }
        }
      } catch {
        // get_pk not available in this contract — fine
      }
    }
  } catch {
    // Contract spec not available; treat as a generic contract account
  }

  // Load SAC balances and auth history in parallel
  const [sacBalances, authHistory] = await Promise.all([
    fetchSacBalances(contractId, network),
    fetchAuthHistory(contractId, network),
  ])

  return {
    contractId,
    isPasskeySmartWallet,
    registeredPublicKey,
    sacBalances,
    authHistory,
    fetchedAt: new Date().toISOString(),
    network,
  }
}

// ─── WebAuthn signing flow for Soroban auth entries ───────────────────────────

/**
 * Sign a Soroban auth entry with a WebAuthn passkey.
 *
 * Flow:
 * 1. Derive the 32-byte WebAuthn challenge from the auth entry XDR +
 *    network passphrase (so the contract can verify it on-chain).
 * 2. Call assertPasskey() to prompt the user for their passkey.
 * 3. Build a SorobanAuthPayload from the assertion response.
 * 4. Encode the payload as a ScMap XDR (the contract's credential structure).
 *
 * @param request  SmartWalletSigningRequest
 */
export async function signSorobanAuthEntry(
  request: SmartWalletSigningRequest,
): Promise<SmartWalletSigningResult> {
  // Resolve credential details from the request or stored metadata
  const storedCredential = loadPasskeyCredential()
  const credentialId = request.credentialId ?? storedCredential?.credentialId
  const compressedPublicKey =
    request.compressedPublicKey ?? storedCredential?.compressedPublicKey

  if (!compressedPublicKey) {
    throw new Error(
      'No passkey credential found. Create a passkey first via the Wallet panel.',
    )
  }

  // Derive the deterministic challenge for this auth entry
  const challenge = await deriveAuthEntryChallenge(
    request.authEntryXdr,
    request.networkPassphrase,
  )

  // Prompt the user for their passkey
  const assertion = await assertPasskey(challenge, credentialId, request.rpId)

  // Build the structured payload and encode the auth entry
  const authPayload = buildSorobanAuthPayload(assertion, compressedPublicKey)
  const authEntryXdr = buildSorobanAuthEntry(authPayload)

  return { assertion, authPayload, authEntryXdr }
}
