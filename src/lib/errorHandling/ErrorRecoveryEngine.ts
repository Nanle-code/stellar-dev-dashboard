/**
 * ErrorRecoveryEngine.ts — Intelligent Error Recovery System
 *
 * Analyzes errors and provides personalized guidance based on:
 *   - User expertise level (beginner / intermediate / expert)
 *   - Historical solutions (learned from past resolutions)
 *   - Contextual information (network, operation type, service)
 *
 * Core capabilities:
 *   1. Enhanced error classification & sub-typing
 *   2. Solution recommendation with confidence scoring
 *   3. Expertise-aware explanation generation
 *   4. Step-by-step recovery guidance
 *   5. Learning from successful/failed resolutions (localStorage persistence)
 *
 * Integrates with:
 *   - src/utils/errorHandler.ts (categorizeError, handleGlobalError)
 *   - src/lib/errorHandling/ErrorHandler.ts
 *   - src/components/ErrorBoundary.tsx
 *   - src/lib/errorReporting.ts (reportError, addBreadcrumb)
 */

import { createLogger } from '../../utils/logger'
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  categorizeError,
  formatErrorMessage,
  type ErrorCategory,
  type ErrorSeverity,
} from '../../utils/errorHandler'

const logger = createLogger('ErrorRecoveryEngine')

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ExpertiseLevel = 'beginner' | 'intermediate' | 'expert'

export interface RecoveryStep {
  /** 1-based step number */
  step: number
  /** Short title for the step */
  title: string
  /** Detailed description adapted to expertise level */
  description: string
  /** Optional action label for a button */
  actionLabel?: string
  /** Whether this step can be automated */
  automated?: boolean
  /** Expected outcome after completing the step */
  expectedOutcome?: string
}

export interface ExpertiseExplanation {
  beginner: string
  intermediate: string
  expert: string
}

export interface Solution {
  id: string
  /** Error category this solution addresses */
  category: ErrorCategory
  /** Sub-type for more granular classification */
  subType?: string
  /** String patterns to match against the error message (lowercase) */
  patterns: string[]
  /** Human-readable title */
  title: string
  /** Short summary */
  summary: string
  /** Expertise-level-aware explanations */
  explanation: ExpertiseExplanation
  /** Ordered recovery steps */
  steps: RecoveryStepTemplate[]
  /** Prerequisites before attempting (e.g. "Wallet connected") */
  prerequisites?: string[]
  /** Base confidence score 0–1 before learning adjustments */
  baseConfidence: number
  /** Whether this solution can be auto-applied */
  autoApplicable?: boolean
  /** Related solution IDs */
  related?: string[]
}

/** Step template before expertise adaptation */
interface RecoveryStepTemplate {
  title: string
  descriptions: ExpertiseExplanation
  actionLabel?: string
  automated?: boolean
  expectedOutcome?: string
}

export interface RecoveryGuidance {
  /** Unique ID for this guidance session */
  id: string
  /** Original error */
  error: unknown
  /** Classified error info */
  classification: {
    category: ErrorCategory
    severity: ErrorSeverity
    subType: string
    errorMessage: string
    confidence: number
  }
  /** Recommended solutions, sorted by confidence */
  solutions: RecommendedSolution[]
  /** Expertise level used for explanations */
  expertiseLevel: ExpertiseLevel
  /** Timestamp */
  timestamp: string
}

export interface RecommendedSolution {
  solution: Solution
  /** Adjusted confidence score 0–1 after learning */
  confidence: number
  /** Number of times this solution was attempted */
  attempts: number
  /** Number of times this solution succeeded */
  successes: number
  /** Learned success rate 0–1 */
  learnedSuccessRate: number
  /** Adapted steps for the user's expertise level */
  adaptedSteps: RecoveryStep[]
}

export interface ResolutionFeedback {
  solutionId: string
  errorSignature: string
  successful: boolean
  timestamp: string
  expertiseLevel: ExpertiseLevel
  context?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOLUTION DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

const SOLUTION_DB: Solution[] = [
  // ── Network errors ─────────────────────────────────────────────────────────
  {
    id: 'sol-network-reconnect',
    category: ERROR_CATEGORIES.NETWORK,
    patterns: ['network error', 'network failed', 'connection refused', 'failed to fetch', 'err_network'],
    title: 'Reconnect to the Network',
    summary: 'Your connection to the internet or Stellar network was interrupted. Verify connectivity and retry.',
    explanation: {
      beginner:
        'The app cannot reach the Stellar network. This usually means your internet connection is down or unstable. ' +
        'Check your Wi-Fi or cable connection, then refresh the page.',
      intermediate:
        'A network-level failure occurred (fetch rejected or connection refused). This is typically caused by a ' +
        'DNS issue, CORS restriction, or the Horizon endpoint being unreachable. Verify network connectivity and ' +
        'check https://status.stellar.org for ongoing incidents.',
      expert:
        'The fetch request was rejected at the transport layer (ERR_NETWORK / ECONNREFUSED). Possible causes: ' +
        'DNS resolution failure, CORS pre-flight rejection, Horizon node outage, or a local proxy/firewall ' +
        'blocking the request. Inspect the Network tab → Headers for the failing request and verify the Horizon ' +
        'base URL is correct in your environment config.',
    },
    steps: [
      {
        title: 'Check internet connectivity',
        descriptions: {
          beginner: 'Make sure your device is connected to the internet. Try opening another website like google.com.',
          intermediate: 'Verify that navigator.onLine returns true and that the browser has network access.',
          expert: 'Check navigator.onLine and run a fetch to a known endpoint (e.g. https://horizon-testnet.stellar.org) to verify connectivity.',
        },
        expectedOutcome: 'Browser confirms internet is available',
      },
      {
        title: 'Check Stellar network status',
        descriptions: {
          beginner: 'Visit https://status.stellar.org to see if the Stellar network is having issues.',
          intermediate: 'Check https://status.stellar.org for ongoing incidents or degraded performance.',
          expert: 'Query the Horizon /metrics endpoint directly and verify the ledger close time is within 10s of the current time.',
        },
        actionLabel: 'Open Stellar Status',
        expectedOutcome: 'No incidents reported or known outage acknowledged',
      },
      {
        title: 'Refresh the page',
        descriptions: {
          beginner: 'Click the refresh button in your browser or press Ctrl+R (Cmd+R on Mac).',
          intermediate: 'Trigger a full page reload to re-initialize the application state and reconnect.',
          expert: 'Hard-refresh (Ctrl+Shift+R) to bypass cache and re-establish the WebSocket connection to the streaming endpoint.',
        },
        actionLabel: 'Refresh Page',
        expectedOutcome: 'Application loads and data appears',
      },
    ],
    prerequisites: ['Internet connection'],
    baseConfidence: 0.85,
    autoApplicable: false,
    related: ['sol-network-timeout', 'sol-cors-check'],
  },
  {
    id: 'sol-network-timeout',
    category: ERROR_CATEGORIES.NETWORK,
    subType: 'timeout',
    patterns: ['timeout', 'timed out', 'econnaborted', 'etimedout', 'gateway timeout'],
    title: 'Resolve Request Timeout',
    summary: 'The request to the Stellar network took too long to respond. Retry with a longer timeout or switch networks.',
    explanation: {
      beginner:
        'The app waited too long for a response from the Stellar network. This is usually temporary. ' +
        'Wait a moment and try again.',
      intermediate:
        'The request exceeded its timeout threshold (typically 30s). This can be caused by network congestion, ' +
        'a slow Horizon node, or a large query. Consider reducing the query scope or increasing the timeout.',
      expert:
        'The request timed out (ECONNABORTED / ETIMEDOUT). Check the Horizon response time via /metrics. ' +
        'If the node is overloaded, switch to a different Horizon instance or reduce cursor window. ' +
        'For streaming endpoints, verify the keep-alive interval is sufficient.',
    },
    steps: [
      {
        title: 'Wait and retry',
        descriptions: {
          beginner: 'Wait 10 seconds, then click the retry button.',
          intermediate: 'Wait briefly and retry. If using retryWithBackoff, the system will auto-retry with exponential delay.',
          expert: 'The RetryManager will apply exponential backoff with jitter. If all retries fail, consider increasing the base delay or maxRetries.',
        },
        automated: true,
        expectedOutcome: 'Request succeeds on retry',
      },
      {
        title: 'Switch to alternate Horizon instance',
        descriptions: {
          beginner: 'The app will try a different server automatically.',
          intermediate: 'Switch to an alternate Horizon URL (e.g. from public to a regional instance).',
          expert: 'Configure an alternate Horizon base URL. Check https://dashboard.stellar.org for available public instances and their response times.',
        },
        actionLabel: 'Switch Horizon',
        expectedOutcome: 'Request succeeds on alternate instance',
      },
    ],
    prerequisites: ['Internet connection'],
    baseConfidence: 0.75,
    related: ['sol-network-reconnect'],
  },
  {
    id: 'sol-cors-check',
    category: ERROR_CATEGORIES.NETWORK,
    subType: 'cors',
    patterns: ['cors', 'cross-origin', 'blocked by cors policy'],
    title: 'Fix CORS Policy Error',
    summary: 'The browser blocked the request due to CORS policy. Use a CORS-enabled endpoint or proxy.',
    explanation: {
      beginner:
        'The browser security settings blocked this request. This is a configuration issue — you may need to use a different network endpoint.',
      intermediate:
        'The Horizon endpoint does not include the necessary CORS headers. Use a CORS-enabled Horizon instance ' +
        'or route requests through a proxy server.',
      expert:
        'CORS pre-flight (OPTIONS) was rejected. Verify the Access-Control-Allow-Origin header on the Horizon ' +
        'response. For local development, use a proxy in vite.config.js or configure the Horizon instance with ' +
        'proper CORS settings (Access-Control-Allow-Origin: *).',
    },
    steps: [
      {
        title: 'Switch to a CORS-enabled Horizon endpoint',
        descriptions: {
          beginner: 'The app will try using a different server that allows browser requests.',
          intermediate: 'Switch to a Horizon instance that returns Access-Control-Allow-Origin headers.',
          expert: 'Point the app to https://horizon-testnet.stellar.org or https://horizon.stellar.org which have CORS enabled. For custom instances, configure the web server to add CORS headers.',
        },
        actionLabel: 'Switch Endpoint',
        expectedOutcome: 'Request succeeds without CORS error',
      },
    ],
    baseConfidence: 0.7,
    related: ['sol-network-reconnect'],
  },

  // ── Rate limit errors ───────────────────────────────────────────────────────
  {
    id: 'sol-rate-limit-wait',
    category: ERROR_CATEGORIES.RATE_LIMIT,
    patterns: ['rate limit', '429', 'too many requests', 'rate_limit_exceeded'],
    title: 'Handle Rate Limiting',
    summary: 'You are sending requests too quickly. Slow down and retry after a brief wait.',
    explanation: {
      beginner:
        'You are asking the Stellar network for information too fast. The network is asking you to slow down. ' +
        'Wait a few seconds and try again.',
      intermediate:
        'Horizon enforces a rate limit (100 requests/minute per IP on public nodes). The Retry-After header ' +
        'indicates when to retry. Consider implementing request batching or caching.',
      expert:
        'Horizon returns HTTP 429 with a Retry-After header. The public Horizon limit is 100 req/min per IP. ' +
        'Implement a token-bucket rate limiter client-side, cache responses with ETags, or use streaming endpoints ' +
        'instead of polling. For high-throughput scenarios, run your own Horizon instance.',
    },
    steps: [
      {
        title: 'Wait for the rate limit window to reset',
        descriptions: {
          beginner: 'Wait about 60 seconds for the limit to reset, then try again.',
          intermediate: 'Wait for the Retry-After period (usually 60s) before retrying.',
          expert: 'Read the Retry-After header value and wait accordingly. The rate limit window resets every 60 seconds on public Horizon.',
        },
        automated: true,
        expectedOutcome: 'Rate limit window resets',
      },
      {
        title: 'Enable caching to reduce requests',
        descriptions: {
          beginner: 'The app will remember previous results so it does not need to ask again.',
          intermediate: 'Enable response caching with SWR or a similar cache layer to avoid redundant requests.',
          expert: 'Implement an ETag-based cache layer. Use the If-None-Match header on subsequent requests. Horizon returns 304 if the resource has not changed, which does not count against the rate limit.',
        },
        actionLabel: 'Enable Caching',
        expectedOutcome: 'Reduced request frequency',
      },
      {
        title: 'Switch to streaming for real-time data',
        descriptions: {
          beginner: 'Instead of repeatedly checking, the app will listen for updates automatically.',
          intermediate: 'Use Horizon streaming endpoints instead of polling to avoid rate limits.',
          expert: 'Replace polling with /payments?cursor=now SSE streaming. This uses a single long-lived connection and does not count against the rate limit.',
        },
        actionLabel: 'Enable Streaming',
        expectedOutcome: 'Single streaming connection replaces polling',
      },
    ],
    baseConfidence: 0.9,
    autoApplicable: true,
    related: ['sol-network-timeout'],
  },

  // ── Authentication errors ───────────────────────────────────────────────────
  {
    id: 'sol-auth-reconnect-wallet',
    category: ERROR_CATEGORIES.AUTHENTICATION,
    patterns: ['unauthorized', 'not connected', 'wallet not connected', 'no wallet', 'freighter', 'albedo', 'xbull'],
    title: 'Reconnect Your Wallet',
    summary: 'Your wallet connection has expired or was not established. Reconnect to authenticate.',
    explanation: {
      beginner:
        'You need to connect your Stellar wallet (like Freighter or Albedo) to use this feature. ' +
        'Click the "Connect Wallet" button and approve the connection.',
      intermediate:
        'The wallet session has expired or was never established. Re-initialize the wallet connection and ' +
        'ensure the public key is available to the application context.',
      expert:
        'The wallet provider returned an authentication error (401 or missing public key). Check the wallet ' +
        'extension state, re-request permissions via the wallet SDK, and verify the signed transaction includes ' +
        'the correct source account. For Freighter, ensure the extension is unlocked and the network matches.',
    },
    steps: [
      {
        title: 'Check wallet extension',
        descriptions: {
          beginner: 'Make sure your wallet extension (Freighter, Albedo, etc.) is installed and unlocked.',
          intermediate: 'Verify the wallet extension is installed, enabled, and unlocked in your browser.',
          expert: 'Check that the wallet extension is injected into window.freighter or window.albedo. Verify the extension is unlocked and the network (testnet/mainnet) matches.',
        },
        expectedOutcome: 'Wallet extension is available and unlocked',
      },
      {
        title: 'Reconnect wallet',
        descriptions: {
          beginner: 'Click "Connect Wallet" and approve the connection in the popup.',
          intermediate: 'Trigger the wallet connection flow and approve the permission request.',
          expert: 'Call the wallet SDK connect() method and handle the permission grant response. Store the public key in application state.',
        },
        actionLabel: 'Connect Wallet',
        expectedOutcome: 'Wallet connected and public key available',
      },
      {
        title: 'Verify network match',
        descriptions: {
          beginner: 'Make sure your wallet is set to the same network (Testnet or Mainnet) as the app.',
          intermediate: 'Ensure the wallet network setting matches the application network configuration.',
          expert: 'Compare the wallet network (wallet.getNetwork()) with the application network config. Mismatched networks will cause transaction submission failures.',
        },
        expectedOutcome: 'Wallet and app are on the same network',
      },
    ],
    prerequisites: ['Wallet extension installed'],
    baseConfidence: 0.88,
    related: ['sol-permission-check'],
  },

  // ── Permission errors ───────────────────────────────────────────────────────
  {
    id: 'sol-permission-check',
    category: ERROR_CATEGORIES.PERMISSION,
    patterns: ['forbidden', '403', 'permission denied', 'access denied', 'not authorized'],
    title: 'Resolve Permission Denied',
    summary: 'Your account does not have sufficient permissions for this operation. Check account thresholds and signer weights.',
    explanation: {
      beginner:
        'Your Stellar account does not have the right permissions to do this action. ' +
        'This may require additional signers or a higher permission level.',
      intermediate:
        'The operation requires a signer weight above the account threshold. Check the account thresholds ' +
        '(low, medium, high) and verify the current signer weight.',
      expert:
        'HTTP 403 / op_threshold. The operation threshold exceeds the signer weight. Inspect the account ' +
        'entry via /accounts/{id} → thresholds and signers. For multisig, collect signatures from enough ' +
        'co-signers to meet the threshold. Use setOptions to adjust thresholds if appropriate.',
    },
    steps: [
      {
        title: 'Check account thresholds',
        descriptions: {
          beginner: 'The app will check your account permission settings.',
          intermediate: 'Query the account thresholds (low_threshold, med_threshold, high_threshold) and compare with the operation type.',
          expert: 'GET /accounts/{publicKey} and inspect thresholds. Payment = low, Trustline/AllowTrust = medium, SetOptions/AccountMerge = high. Verify signer weights sum meets the threshold.',
        },
        actionLabel: 'Check Thresholds',
        expectedOutcome: 'Threshold values displayed',
      },
      {
        title: 'Collect additional signatures (multisig)',
        descriptions: {
          beginner: 'If you use a multi-signature setup, other signers need to approve this action.',
          intermediate: 'For multisig accounts, gather signatures from enough co-signers to meet the threshold weight.',
          expert: 'Build a transaction with the required operations, sign with available signers, then use the multisig coordination endpoint or a co-signer service to collect additional signatures until the threshold is met.',
        },
        expectedOutcome: 'Sufficient signatures collected',
      },
    ],
    baseConfidence: 0.7,
    related: ['sol-auth-reconnect-wallet', 'sol-stellar-bad-auth'],
  },

  // ── Validation errors ───────────────────────────────────────────────────────
  {
    id: 'sol-validation-invalid-key',
    category: ERROR_CATEGORIES.VALIDATION,
    subType: 'invalid_key',
    patterns: ['invalid public key', 'invalid secret', 'invalid key', 'key is not valid', 'ed25519'],
    title: 'Fix Invalid Public Key',
    summary: 'The provided Stellar public key is malformed. Verify the key format and try again.',
    explanation: {
      beginner:
        'The account address you entered is not valid. A Stellar address starts with the letter "G" ' +
        'and is 56 characters long.',
      intermediate:
        'The provided key is not a valid Ed25519 public key. Stellar public keys start with "G" and are ' +
        'base32-encoded (56 chars). Secret keys start with "S".',
      expert:
        'The key failed StrKey.isValidEd25519PublicKey() validation. Ensure the key is 56 chars, starts with "G" ' +
        '(public) or "S" (secret), and is base32-encoded. Check for whitespace, copy-paste artifacts, or ' +
        'truncation. Use @stellar/stellar-sdk StrKey.decode() for detailed validation.',
    },
    steps: [
      {
        title: 'Verify key format',
        descriptions: {
          beginner: 'Make sure your key starts with "G" and is exactly 56 characters long.',
          intermediate: 'Validate: starts with "G" (public) or "S" (secret), 56 characters, base32 alphabet.',
          expert: 'Use Keypair.fromPublicKey(key) or StrKey.isValidEd25519PublicKey(key) to validate programmatically.',
        },
        actionLabel: 'Validate Key',
        expectedOutcome: 'Key passes validation',
      },
      {
        title: 'Re-copy the key',
        descriptions: {
          beginner: 'Copy the key again from your wallet, making sure not to miss any characters.',
          intermediate: 'Re-copy the key from the source, trimming any whitespace or hidden characters.',
          expert: 'Strip whitespace and BOM characters. Use navigator.clipboard.readText() and trim() before validation.',
        },
        expectedOutcome: 'Clean key string obtained',
      },
    ],
    baseConfidence: 0.92,
    autoApplicable: true,
  },
  {
    id: 'sol-validation-invalid-amount',
    category: ERROR_CATEGORIES.VALIDATION,
    subType: 'invalid_amount',
    patterns: ['invalid amount', 'amount must be', 'negative amount', 'amount exceeds', 'insufficient precision'],
    title: 'Fix Invalid Amount',
    summary: 'The transaction amount is invalid. Check for negative values, excessive precision, or amount limits.',
    explanation: {
      beginner:
        'The amount you entered is not valid. Make sure it is a positive number and does not have too many decimal places.',
      intermediate:
        'Stellar amounts must be positive, and the precision depends on the asset (XLM: 7 decimals). ' +
        'Verify the amount does not exceed the balance minus fees.',
      expert:
        'Stellar stores amounts as int64 with 7 decimal places (10^-7 precision). Negative amounts are invalid. ' +
        'For XLM, the amount + fee must not exceed the account balance. Use BigNumber for precision-safe arithmetic.',
    },
    steps: [
      {
        title: 'Verify amount is positive',
        descriptions: {
          beginner: 'Make sure the amount is greater than zero.',
          intermediate: 'Ensure the amount is a positive number greater than 0.',
          expert: 'Validate amount > 0 using BigNumber comparison. Reject NaN, Infinity, and negative values.',
        },
        expectedOutcome: 'Amount is positive',
      },
      {
        title: 'Check decimal precision',
        descriptions: {
          beginner: 'Use at most 7 decimal places for XLM.',
          intermediate: 'Ensure the amount has at most 7 decimal places for XLM, or the asset-specific precision.',
          expert: 'Truncate to 7 decimal places using BigNumber.round(7). For non-native assets, check the asset precision from the /assets endpoint.',
        },
        expectedOutcome: 'Amount precision is valid',
      },
      {
        title: 'Verify sufficient balance',
        descriptions: {
          beginner: 'Make sure your account has enough funds, including for the transaction fee.',
          intermediate: 'Check that amount + base_fee < account balance.',
          expert: 'Query /accounts/{id}/balances and verify amount + fee + min_reserve < native_balance. Account for trustline reserves (0.5 XLM per trustline).',
        },
        actionLabel: 'Check Balance',
        expectedOutcome: 'Sufficient balance confirmed',
      },
    ],
    baseConfidence: 0.85,
    autoApplicable: true,
  },

  // ── Stellar-specific errors ─────────────────────────────────────────────────
  {
    id: 'sol-stellar-bad-seq',
    category: ERROR_CATEGORIES.STELLAR,
    subType: 'tx_bad_seq',
    patterns: ['tx_bad_seq', 'bad sequence', 'sequence number', 'sequence mismatch'],
    title: 'Fix Transaction Sequence Number',
    summary: 'The transaction sequence number does not match the account. Fetch the current sequence and retry.',
    explanation: {
      beginner:
        'Your transaction used an old reference number. The app will fetch a new one and retry automatically.',
      intermediate:
        'tx_bad_seq: The transaction sequence number does not match the current account sequence. ' +
        'Fetch the latest sequence from Horizon and rebuild the transaction.',
      expert:
        'tx_bad_seq: The seqnum in the transaction envelope does not match account.seqnum on the ledger. ' +
        'This happens when another transaction from the same account was submitted between fetch and submit. ' +
        'Re-fetch /accounts/{id} for the current sequence, increment by 1, and rebuild the XDR.',
    },
    steps: [
      {
        title: 'Fetch current account sequence',
        descriptions: {
          beginner: 'The app will get the latest account information from the network.',
          intermediate: 'Re-fetch /accounts/{publicKey} to get the current sequence number.',
          expert: 'GET /accounts/{publicKey} and read .sequence. Use this value + 1 as the transaction sequence.',
        },
        automated: true,
        expectedOutcome: 'Current sequence number obtained',
      },
      {
        title: 'Rebuild and resubmit transaction',
        descriptions: {
          beginner: 'The app will create a new transaction with the correct number and submit it.',
          intermediate: 'Rebuild the transaction with the updated sequence number and resubmit.',
          expert: 'Create a new TransactionBuilder with account.loadAccount(sequence). Sign and submit the new XDR.',
        },
        automated: true,
        actionLabel: 'Resubmit Transaction',
        expectedOutcome: 'Transaction submitted successfully',
      },
    ],
    baseConfidence: 0.95,
    autoApplicable: true,
    related: ['sol-stellar-insufficient-balance'],
  },
  {
    id: 'sol-stellar-insufficient-balance',
    category: ERROR_CATEGORIES.STELLAR,
    subType: 'tx_insufficient_balance',
    patterns: ['insufficient balance', 'tx_insufficient_balance', 'op_underfunded', 'underfunded'],
    title: 'Resolve Insufficient Balance',
    summary: 'The account does not have enough funds to complete the transaction. Add funds or reduce the amount.',
    explanation: {
      beginner:
        'Your account does not have enough XLM or asset balance for this transaction. ' +
        'You may need to add funds to your account.',
      intermediate:
        'The source account balance is insufficient to cover the amount + fee + minimum reserve. ' +
        'Fund the account from Friendbot (testnet) or transfer from another account.',
      expert:
        'op_underfunded / tx_insufficient_balance: The source account cannot pay amount + base_fee + ' +
        'min_reserve (2 + subentries) * 0.5 XLM. On testnet, fund via Friendbot. On mainnet, transfer from ' +
        'another account. Check for pending trustlines that increase the reserve requirement.',
    },
    steps: [
      {
        title: 'Check account balance',
        descriptions: {
          beginner: 'The app will show your current balance.',
          intermediate: 'Query /accounts/{id}/balances to see the available balance for the asset.',
          expert: 'GET /accounts/{id}/balances and compute available = balance - base_fee - min_reserve. Min reserve = (2 + num_subentries) * 0.5 XLM.',
        },
        actionLabel: 'Check Balance',
        expectedOutcome: 'Current balance displayed',
      },
      {
        title: 'Fund account (testnet)',
        descriptions: {
          beginner: 'If using the test network, you can get free test XLM from the Friendbot.',
          intermediate: 'On testnet, fund the account via https://friendbot.stellar.org?addr={publicKey}.',
          expert: 'POST to https://friendbot.stellar.org?addr={publicKey} to fund the account with 10,000 test XLM. Only available on testnet.',
        },
        actionLabel: 'Fund with Friendbot',
        expectedOutcome: 'Account funded with test XLM',
      },
      {
        title: 'Reduce transaction amount',
        descriptions: {
          beginner: 'Try sending a smaller amount.',
          intermediate: 'Reduce the transaction amount to fit within the available balance.',
          expert: 'Calculate the maximum sendable amount: balance - base_fee - min_reserve. If using path payments, verify the source amount is within limits.',
        },
        expectedOutcome: 'Adjusted amount within balance',
      },
    ],
    baseConfidence: 0.88,
    related: ['sol-stellar-bad-seq', 'sol-validation-invalid-amount'],
  },
  {
    id: 'sol-stellar-bad-auth',
    category: ERROR_CATEGORIES.STELLAR,
    subType: 'tx_bad_auth',
    patterns: ['tx_bad_auth', 'bad auth', 'signature', 'signing key', 'insufficient weight'],
    title: 'Fix Transaction Authorization',
    summary: 'The transaction has invalid or insufficient signatures. Re-sign with the correct key.',
    explanation: {
      beginner:
        'The transaction was not properly signed. Your wallet needs to approve the transaction again.',
      intermediate:
        'tx_bad_auth: The transaction signatures are invalid or insufficient. Verify the signing key matches ' +
        'the source account and re-sign the transaction.',
      expert:
        'tx_bad_auth: Either the signature is invalid (wrong key) or the total signer weight is below the ' +
        'operation threshold. Re-sign with the correct secret key. For multisig, collect enough signatures. ' +
        'Verify the signature hint matches the source account.',
    },
    steps: [
      {
        title: 'Verify signing key',
        descriptions: {
          beginner: 'Make sure you are using the correct wallet/account to sign.',
          intermediate: 'Verify the signing key matches the source account public key.',
          expert: 'Compare the source account public key with the keypair used to sign. The signature hint must match one of the account signers.',
        },
        expectedOutcome: 'Correct signing key identified',
      },
      {
        title: 'Re-sign and resubmit',
        descriptions: {
          beginner: 'Approve the transaction in your wallet popup and the app will resubmit it.',
          intermediate: 'Re-sign the transaction with the correct key and resubmit.',
          expert: 'Rebuild the transaction XDR, sign with the correct keypair, and submit. For multisig, use transaction.sign() for each signer.',
        },
        actionLabel: 'Re-sign Transaction',
        expectedOutcome: 'Transaction signed and submitted',
      },
    ],
    baseConfidence: 0.82,
    related: ['sol-auth-reconnect-wallet', 'sol-permission-check'],
  },
  {
    id: 'sol-stellar-no-account',
    category: ERROR_CATEGORIES.STELLAR,
    subType: 'account_not_found',
    patterns: ['account not found', 'tx_no_account', 'source account does not exist', 'not found on'],
    title: 'Account Not Found on Network',
    summary: 'The specified account does not exist on the Stellar network. Create or fund the account first.',
    explanation: {
      beginner:
        'This account does not exist on the Stellar network yet. It needs to be created by sending it a minimum ' +
        'amount of XLM.',
      intermediate:
        'The account has not been created on the ledger. Accounts are created by receiving a CreateAccount ' +
        'operation with at least 1 XLM (the minimum balance for a new account).',
      expert:
        'The account does not exist on the ledger (404 from /accounts/{id}). Create it via a CreateAccount ' +
        'operation from a funded account, sending at least the minimum reserve (1 XLM base). On testnet, ' +
        'use Friendbot. Verify the key is correct before funding.',
    },
    steps: [
      {
        title: 'Verify the public key is correct',
        descriptions: {
          beginner: 'Double-check that you entered the right account address.',
          intermediate: 'Verify the public key is correct and not truncated.',
          expert: 'Validate the StrKey encoding and verify it is the intended account. Common mistake: using a secret key (starts with S) instead of public key (starts with G).',
        },
        expectedOutcome: 'Correct public key confirmed',
      },
      {
        title: 'Create/fund the account',
        descriptions: {
          beginner: 'If this is a test account, get free XLM from Friendbot. If real, send XLM from another account.',
          intermediate: 'On testnet: use Friendbot. On mainnet: send a CreateAccount operation from a funded account.',
          expert: 'On testnet: POST https://friendbot.stellar.org?addr={publicKey}. On mainnet: submit a transaction with a CreateAccount operation, sending at least 1 XLM as the starting balance.',
        },
        actionLabel: 'Fund Account',
        expectedOutcome: 'Account created on the ledger',
      },
    ],
    baseConfidence: 0.9,
    related: ['sol-stellar-insufficient-balance'],
  },
  {
    id: 'sol-stellar-no-trust',
    category: ERROR_CATEGORIES.STELLAR,
    subType: 'op_no_trust',
    patterns: ['op_no_trust', 'no trustline', 'trustline', 'not authorized'],
    title: 'Establish Trustline',
    summary: 'The destination account has no trustline for the asset. Create a trustline first.',
    explanation: {
      beginner:
        'To receive a custom asset (not XLM), the receiving account needs to "trust" it first. ' +
        'Create a trustline for the asset.',
      intermediate:
        'op_no_trust: The destination account does not have a trustline for the asset being sent. ' +
        'The recipient must submit a ChangeTrust operation to create the trustline.',
      expert:
        'op_no_trust: The destination account lacks a trustline for the asset. Submit a ChangeTrust ' +
        'operation from the destination account, specifying the asset issuer and code. The trustline limit ' +
        'must be > 0. If the issuer has auth_required, wait for authorization before sending.',
    },
    steps: [
      {
        title: 'Create trustline on the destination account',
        descriptions: {
          beginner: 'The receiving account needs to add this asset to their wallet first.',
          intermediate: 'The recipient must submit a ChangeTrust operation for this asset.',
          expert: 'Build a ChangeTrust operation with the asset (code + issuer) and a limit. Submit from the destination account. The trustline creates a subentry (0.5 XLM reserve).',
        },
        actionLabel: 'Create Trustline',
        expectedOutcome: 'Trustline established',
      },
      {
        title: 'Verify issuer authorization (if required)',
        descriptions: {
          beginner: 'Some assets require approval from the issuer before you can use them.',
          intermediate: 'If the issuer has auth_required, verify the account is authorized to hold the asset.',
          expert: 'Check the /accounts/{id}?data=auth_required flag. If set, the issuer must submit an AllowTrust operation before the trustline is active.',
        },
        expectedOutcome: 'Account authorized for the asset',
      },
    ],
    baseConfidence: 0.82,
    related: ['sol-stellar-insufficient-balance'],
  },
  {
    id: 'sol-stellar-fee-low',
    category: ERROR_CATEGORIES.STELLAR,
    subType: 'tx_insufficient_fee',
    patterns: ['tx_insufficient_fee', 'fee too low', 'insufficient fee', 'base fee'],
    title: 'Increase Transaction Fee',
    summary: 'The transaction fee is below the network minimum. Increase the base fee and resubmit.',
    explanation: {
      beginner:
        'The network fee for your transaction is too low. The app will increase it and retry.',
      intermediate:
        'tx_insufficient_fee: The fee bid is below the current network base fee. Fetch the latest fee stats ' +
        'and increase the transaction fee.',
      expert:
        'tx_insufficient_fee: The transaction fee is below the network minimum. Query /fee_stats for the current ' +
        'accepted fee percentile (usually p10–p30). Set the fee to at least the p30 value. During high congestion, ' +
        'use a higher percentile to ensure inclusion.',
    },
    steps: [
      {
        title: 'Fetch current fee stats',
        descriptions: {
          beginner: 'The app will check the current network fee requirements.',
          intermediate: 'Query /fee_stats for the current accepted fee percentiles.',
          expert: 'GET /fee_stats and read fee_charged.p10–p99. Use p30 as a safe default for normal conditions.',
        },
        automated: true,
        actionLabel: 'Check Fees',
        expectedOutcome: 'Current fee stats obtained',
      },
      {
        title: 'Rebuild transaction with higher fee',
        descriptions: {
          beginner: 'The app will create a new transaction with the correct fee.',
          intermediate: 'Set the baseFee to at least the p30 percentile and rebuild the transaction.',
          expert: 'Use TransactionBuilder.setFee(recommendedFee) and rebuild the XDR. Sign and resubmit.',
        },
        automated: true,
        actionLabel: 'Resubmit with Higher Fee',
        expectedOutcome: 'Transaction accepted with correct fee',
      },
    ],
    baseConfidence: 0.93,
    autoApplicable: true,
    related: ['sol-stellar-bad-seq'],
  },

  // ── Unknown errors ───────────────────────────────────────────────────────────
  {
    id: 'sol-unknown-generic',
    category: ERROR_CATEGORIES.UNKNOWN,
    patterns: [],
    title: 'General Troubleshooting',
    summary: 'An unexpected error occurred. Try refreshing the page or clearing browser cache.',
    explanation: {
      beginner:
        'Something went wrong that the app does not recognize. Try refreshing the page. ' +
        'If the problem continues, try clearing your browser cache.',
      intermediate:
        'An unhandled error occurred. Check the browser console for more details. Try a hard refresh ' +
        'and check for JavaScript errors.',
      expert:
        'Unhandled error. Inspect the error stack trace in the console. Check for null reference errors, ' +
        'async rejections, or boundary component crashes. Enable debug logging via setLogLevel(LogLevel.DEBUG) ' +
        'for more context.',
    },
    steps: [
      {
        title: 'Hard refresh the page',
        descriptions: {
          beginner: 'Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to reload the page.',
          intermediate: 'Perform a hard refresh to clear cached JavaScript and re-download assets.',
          expert: 'Ctrl+Shift+R to bypass cache. If using a service worker, unregister it first via DevTools → Application → Service Workers.',
        },
        actionLabel: 'Hard Refresh',
        expectedOutcome: 'Page reloads without error',
      },
      {
        title: 'Clear browser cache and local storage',
        descriptions: {
          beginner: 'Clear your browser data to remove any corrupted cached files.',
          intermediate: 'Clear cache, cookies, and local storage for this site.',
          expert: 'DevTools → Application → Clear storage → Clear site data. This removes cached assets, IDB, localStorage, and service worker registrations.',
        },
        actionLabel: 'Clear Cache',
        expectedOutcome: 'Site data cleared',
      },
      {
        title: 'Report the issue',
        descriptions: {
          beginner: 'If the error continues, please report it so the team can fix it.',
          intermediate: 'Use the in-app error reporting to send details to the development team.',
          expert: 'The error has been automatically reported via the error reporting service with breadcrumbs and session context. Note the error ID for reference.',
        },
        actionLabel: 'Report Issue',
        expectedOutcome: 'Error report submitted',
      },
    ],
    baseConfidence: 0.5,
    related: [],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING SYSTEM (localStorage persistence)
// ═══════════════════════════════════════════════════════════════════════════════

const LEARNING_STORAGE_KEY = 'error-recovery-learning'
const MAX_LEARNING_ENTRIES = 500

interface LearningRecord {
  solutionId: string
  errorSignature: string
  attempts: number
  successes: number
  lastAttempt: string | null
  lastSuccess: string | null
  expertiseLevel: ExpertiseLevel
  context?: string
}

class LearningStore {
  private records: Map<string, LearningRecord> = new Map()
  private loaded = false

  private load(): void {
    if (this.loaded) return
    try {
      const raw = localStorage.getItem(LEARNING_STORAGE_KEY)
      if (raw) {
        const parsed: LearningRecord[] = JSON.parse(raw)
        for (const record of parsed) {
          const key = this.key(record.solutionId, record.errorSignature)
          this.records.set(key, record)
        }
      }
    } catch {
      logger.warn('Failed to load learning data from localStorage')
    }
    this.loaded = true
  }

  private save(): void {
    try {
      const entries = [...this.records.values()]
      // Keep only the most recent entries
      const sorted = entries
        .sort((a, b) => {
          const aTime = a.lastAttempt ? new Date(a.lastAttempt).getTime() : 0
          const bTime = b.lastAttempt ? new Date(b.lastAttempt).getTime() : 0
          return bTime - aTime
        })
        .slice(0, MAX_LEARNING_ENTRIES)
      localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(sorted))
    } catch {
      logger.warn('Failed to save learning data to localStorage')
    }
  }

  private key(solutionId: string, errorSignature: string): string {
    return `${solutionId}::${errorSignature}`
  }

  getRecord(solutionId: string, errorSignature: string): LearningRecord | undefined {
    this.load()
    return this.records.get(this.key(solutionId, errorSignature))
  }

  recordAttempt(solutionId: string, errorSignature: string, successful: boolean, expertiseLevel: ExpertiseLevel, context?: string): void {
    this.load()
    const k = this.key(solutionId, errorSignature)
    const existing = this.records.get(k)
    const now = new Date().toISOString()

    if (existing) {
      existing.attempts++
      if (successful) {
        existing.successes++
        existing.lastSuccess = now
      }
      existing.lastAttempt = now
      existing.expertiseLevel = expertiseLevel
      if (context) existing.context = context
    } else {
      this.records.set(k, {
        solutionId,
        errorSignature,
        attempts: 1,
        successes: successful ? 1 : 0,
        lastAttempt: now,
        lastSuccess: successful ? now : null,
        expertiseLevel,
        context,
      })
    }

    this.save()
  }

  getStats(solutionId: string, errorSignature: string): { attempts: number; successes: number; rate: number } {
    this.load()
    const record = this.records.get(this.key(solutionId, errorSignature))
    if (!record || record.attempts === 0) {
      return { attempts: 0, successes: 0, rate: 0 }
    }
    return {
      attempts: record.attempts,
      successes: record.successes,
      rate: record.successes / record.attempts,
    }
  }

  clearAll(): void {
    this.records.clear()
    try {
      localStorage.removeItem(LEARNING_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  getAll(): LearningRecord[] {
    this.load()
    return [...this.records.values()]
  }
}

const learningStore = new LearningStore()

// ═══════════════════════════════════════════════════════════════════════════════
// EXPERTISE LEVEL DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EXPERTISE_STORAGE_KEY = 'stellar-dev-expertise-level'

/**
 * Detect or load the user's expertise level.
 * The level is stored in localStorage and can be manually set or auto-detected.
 */
export function getExpertiseLevel(): ExpertiseLevel {
  try {
    const stored = localStorage.getItem(EXPERTISE_STORAGE_KEY)
    if (stored === 'beginner' || stored === 'intermediate' || stored === 'expert') {
      return stored
    }
  } catch {
    // localStorage not available
  }

  // Auto-detect based on usage heuristics
  return autoDetectExpertise()
}

/**
 * Manually set the user's expertise level.
 */
export function setExpertiseLevel(level: ExpertiseLevel): void {
  try {
    localStorage.setItem(EXPERTISE_STORAGE_KEY, level)
    logger.info(`Expertise level set to: ${level}`)
  } catch {
    // ignore
  }
}

/**
 * Auto-detect expertise based on usage patterns.
 * - Number of transactions submitted
 * - Use of advanced features (custom fee, multisig, Soroban)
 * - Error recovery success rate
 */
function autoDetectExpertise(): ExpertiseLevel {
  try {
    // Check transaction count
    const txHistory = localStorage.getItem('stellar-tx-count')
    const txCount = txHistory ? parseInt(txHistory, 10) : 0

    // Check advanced feature usage
    const usedAdvancedFeatures = localStorage.getItem('stellar-used-advanced-features') === 'true'

    // Check learning data
    const learning = learningStore.getAll()
    const totalAttempts = learning.reduce((sum, r) => sum + r.attempts, 0)
    const totalSuccesses = learning.reduce((sum, r) => sum + r.successes, 0)
    const successRate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 0

    // Expert: high transaction count + advanced features + high recovery rate
    if (txCount >= 50 && usedAdvancedFeatures && successRate >= 0.7) {
      return 'expert'
    }

    // Intermediate: moderate usage
    if (txCount >= 10 || (totalAttempts >= 5 && successRate >= 0.5)) {
      return 'intermediate'
    }

    return 'beginner'
  } catch {
    return 'beginner'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR SIGNATURE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a stable signature for an error to use as a learning key.
 */
function generateErrorSignature(error: unknown, category: ErrorCategory): string {
  const message = formatErrorMessage(error).toLowerCase()
  // Normalize: remove specific numbers/IDs, keep the pattern
  const normalized = message
    .replace(/[A-Z0-9]{56}/g, '<KEY>') // Replace Stellar public keys
    .replace(/0x[0-9a-f]+/gi, '<HEX>') // Replace hex values
    .replace(/\d+/g, '<NUM>') // Replace numbers
    .replace(/\s+/g, ' ')
    .trim()
  return `${category}::${normalized}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOLUTION MATCHING & RECOMMENDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Match an error against the solution database and return ranked recommendations.
 */
function matchSolutions(
  error: unknown,
  category: ErrorCategory,
  errorMessage: string,
  errorSignature: string,
  expertiseLevel: ExpertiseLevel,
): RecommendedSolution[] {
  const normalizedMessage = errorMessage.toLowerCase()
  const matches: RecommendedSolution[] = []

  for (const solution of SOLUTION_DB) {
    // Category must match
    if (solution.category !== category && solution.category !== ERROR_CATEGORIES.UNKNOWN) {
      continue
    }

    // Check pattern matches
    let patternMatched = false
    let patternScore = 0

    if (solution.patterns.length === 0) {
      // Fallback solution for the category
      patternMatched = true
      patternScore = 0.3
    } else {
      for (const pattern of solution.patterns) {
        if (normalizedMessage.includes(pattern)) {
          patternMatched = true
          patternScore = Math.max(patternScore, 0.9)
        }
      }
    }

    if (!patternMatched) continue

    // Get learning stats
    const stats = learningStore.getStats(solution.id, errorSignature)

    // Calculate confidence score
    const learnedWeight = stats.attempts > 0 ? Math.min(stats.attempts / 5, 1) : 0
    const learnedRate = stats.attempts > 0 ? stats.rate : solution.baseConfidence
    const confidence =
      patternScore * solution.baseConfidence * (1 - learnedWeight * 0.3) +
      learnedRate * learnedWeight * 0.3 +
      patternScore * 0.1 // small boost for pattern match quality

    // Adapt steps for expertise level
    const adaptedSteps = solution.steps.map((template, index) => ({
      step: index + 1,
      title: template.title,
      description: template.descriptions[expertiseLevel],
      actionLabel: template.actionLabel,
      automated: template.automated,
      expectedOutcome: template.expectedOutcome,
    }))

    matches.push({
      solution,
      confidence: Math.min(confidence, 1),
      attempts: stats.attempts,
      successes: stats.successes,
      learnedSuccessRate: stats.rate,
      adaptedSteps,
    })
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence)

  // Always include the fallback "unknown" solution if no matches found
  if (matches.length === 0) {
    const fallback = SOLUTION_DB.find((s) => s.id === 'sol-unknown-generic')
    if (fallback) {
      const stats = learningStore.getStats(fallback.id, errorSignature)
      const adaptedSteps = fallback.steps.map((template, index) => ({
        step: index + 1,
        title: template.title,
        description: template.descriptions[expertiseLevel],
        actionLabel: template.actionLabel,
        automated: template.automated,
        expectedOutcome: template.expectedOutcome,
      }))
      matches.push({
        solution: fallback,
        confidence: fallback.baseConfidence,
        attempts: stats.attempts,
        successes: stats.successes,
        learnedSuccessRate: stats.rate,
        adaptedSteps,
      })
    }
  }

  return matches
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-TYPE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine the error sub-type for more granular classification.
 */
/**
 * Extract the original (raw) error message before formatErrorMessage transforms it.
 * This is used for enhanced pattern matching since formatErrorMessage may
 * normalize messages (e.g. 'Network Error' -> 'Network connection failed...').
 */
function getRawMessage(error: unknown): string {
  if (typeof error === 'string') return error
  const err = error as Record<string, unknown> | null | undefined
  if (err?.message && typeof err.message === 'string') return err.message
  if (typeof error === 'object' && error !== null) {
    const response = (error as any)?.response
    if (response?.data?.message) return String(response.data.message)
    if (response?.data?.detail) return String(response.data.detail)
  }
  return ''
}

/**
 * Enhanced error classification that extends the existing categorizeError.
 * Falls back to additional pattern matching when the base classifier returns UNKNOWN.
 */
function enhancedClassifyError(error: unknown): { category: ErrorCategory; severity: ErrorSeverity } {
  // First try the existing categorizer
  const { category, severity } = categorizeError(error)

  // If already classified (not UNKNOWN), use that
  if (category !== ERROR_CATEGORIES.UNKNOWN) {
    return { category, severity }
  }

  // Enhanced patterns: check both formatted and raw messages
  const formattedMessage = formatErrorMessage(error).toLowerCase()
  const rawMessage = getRawMessage(error).toLowerCase()
  const searchText = `${formattedMessage} ${rawMessage}`

  const enhancedPatterns: Record<string, { category: ErrorCategory; severity: ErrorSeverity }> = {
    // Network patterns (formatErrorMessage may have transformed these)
    'network error': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
    'failed to fetch': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
    'network connection failed': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
    'request timed out': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.MEDIUM },
    'timed out': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.MEDIUM },
    'connection refused': { category: ERROR_CATEGORIES.NETWORK, severity: ERROR_SEVERITY.HIGH },
    // Stellar result code patterns
    'tx_bad_seq': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.HIGH },
    'tx_bad_auth': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.HIGH },
    'tx_insufficient_balance': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'tx_insufficient_fee': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'tx_no_account': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'op_underfunded': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'op_no_trust': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'op_no_destination': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'op_line_full': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'bad sequence': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.HIGH },
    'bad auth': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.HIGH },
    'insufficient balance': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'account does not exist': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    'trustline': { category: ERROR_CATEGORIES.STELLAR, severity: ERROR_SEVERITY.MEDIUM },
    // Rate limit patterns
    'rate limit': { category: ERROR_CATEGORIES.RATE_LIMIT, severity: ERROR_SEVERITY.MEDIUM },
    'too many requests': { category: ERROR_CATEGORIES.RATE_LIMIT, severity: ERROR_SEVERITY.MEDIUM },
    // Auth patterns
    'unauthorized': { category: ERROR_CATEGORIES.AUTHENTICATION, severity: ERROR_SEVERITY.HIGH },
    'wallet not connected': { category: ERROR_CATEGORIES.AUTHENTICATION, severity: ERROR_SEVERITY.HIGH },
    'not connected': { category: ERROR_CATEGORIES.AUTHENTICATION, severity: ERROR_SEVERITY.HIGH },
    // Permission patterns
    'forbidden': { category: ERROR_CATEGORIES.PERMISSION, severity: ERROR_SEVERITY.HIGH },
    'permission denied': { category: ERROR_CATEGORIES.PERMISSION, severity: ERROR_SEVERITY.HIGH },
    'access denied': { category: ERROR_CATEGORIES.PERMISSION, severity: ERROR_SEVERITY.HIGH },
    // Validation patterns
    'invalid public key': { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW },
    'invalid key': { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW },
    'invalid amount': { category: ERROR_CATEGORIES.VALIDATION, severity: ERROR_SEVERITY.LOW },
  }

  for (const [pattern, classification] of Object.entries(enhancedPatterns)) {
    if (searchText.includes(pattern)) {
      return classification
    }
  }

  return { category, severity } // Keep UNKNOWN if nothing matches
}

function classifySubType(error: unknown, category: ErrorCategory): string {
  const message = formatErrorMessage(error).toLowerCase()
  const rawMessage = getRawMessage(error).toLowerCase()
  const searchText = `${message} ${rawMessage}`

  // Check Stellar result codes
  const err = error as Record<string, unknown> | null | undefined
  const resultCodes = (err as any)?.response?.data?.extras?.result_codes
  if (resultCodes) {
    const txCode = resultCodes.transaction as string | undefined
    const opCodes = resultCodes.operations as string[] | undefined
    if (txCode) return txCode
    if (opCodes && opCodes.length > 0) return opCodes[0]
  }

  // Pattern-based sub-typing
  const subTypeMap: Record<string, [string[], ErrorCategory][]> = {
    timeout: [
      [['timeout', 'timed out', 'econnaborted'], ERROR_CATEGORIES.NETWORK],
    ],
    cors: [
      [['cors', 'cross-origin'], ERROR_CATEGORIES.NETWORK],
    ],
    invalid_key: [
      [['invalid public key', 'invalid secret', 'invalid key', 'ed25519'], ERROR_CATEGORIES.VALIDATION],
    ],
    invalid_amount: [
      [['invalid amount', 'amount must be', 'negative amount'], ERROR_CATEGORIES.VALIDATION],
    ],
    tx_bad_seq: [
      [['tx_bad_seq', 'bad sequence', 'sequence number'], ERROR_CATEGORIES.STELLAR],
    ],
    tx_insufficient_balance: [
      [['insufficient balance', 'op_underfunded', 'underfunded'], ERROR_CATEGORIES.STELLAR],
    ],
    tx_bad_auth: [
      [['tx_bad_auth', 'bad auth', 'signature'], ERROR_CATEGORIES.STELLAR],
    ],
    account_not_found: [
      [['account not found', 'tx_no_account'], ERROR_CATEGORIES.STELLAR],
    ],
    op_no_trust: [
      [['op_no_trust', 'no trustline', 'trustline'], ERROR_CATEGORIES.STELLAR],
    ],
    tx_insufficient_fee: [
      [['tx_insufficient_fee', 'fee too low', 'base fee'], ERROR_CATEGORIES.STELLAR],
    ],
  }

  for (const [subType, entries] of Object.entries(subTypeMap)) {
    for (const [patterns, expectedCategory] of entries) {
      if (category !== expectedCategory && category !== ERROR_CATEGORIES.UNKNOWN) continue
      for (const pattern of patterns) {
        if (searchText.includes(pattern)) {
          return subType
        }
      }
    }
  }

  return 'generic'
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze an error and generate personalized recovery guidance.
 *
 * @param error The error to analyze
 * @param options Optional configuration
 * @returns Recovery guidance with ranked solutions
 */
export function analyzeError(
  error: unknown,
  options: {
    expertiseLevel?: ExpertiseLevel
    context?: string
  } = {},
): RecoveryGuidance {
  const expertiseLevel = options.expertiseLevel ?? getExpertiseLevel()
  const { category, severity } = enhancedClassifyError(error)
  const errorMessage = formatErrorMessage(error)
  const subType = classifySubType(error, category)
  const errorSignature = generateErrorSignature(error, category)

  const solutions = matchSolutions(error, category, errorMessage, errorSignature, expertiseLevel)
  // Also pass the raw message for better pattern matching in solutions
  const rawMessage = getRawMessage(error)
  const solutionsWithRaw = matchSolutions(error, category, rawMessage || errorMessage, errorSignature, expertiseLevel)
  // Merge and deduplicate by solution ID, keeping the higher confidence
  const merged = new Map<string, RecommendedSolution>()
  for (const sol of [...solutions, ...solutionsWithRaw]) {
    const existing = merged.get(sol.solution.id)
    if (!existing || sol.confidence > existing.confidence) {
      merged.set(sol.solution.id, sol)
    }
  }
  const finalSolutions = [...merged.values()].sort((a, b) => b.confidence - a.confidence)

  // Calculate overall confidence
  const topConfidence = finalSolutions.length > 0 ? finalSolutions[0].confidence : 0

  logger.info('Error analyzed', {
    category,
    severity,
    subType,
    solutionCount: finalSolutions.length,
    topConfidence,
    expertiseLevel,
  })

  return {
    id: `recovery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    error,
    classification: {
      category,
      severity,
      subType,
      errorMessage,
      confidence: topConfidence,
    },
    solutions: finalSolutions,
    expertiseLevel,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Record the outcome of a recovery attempt.
 * The system learns from this to improve future recommendations.
 *
 * @param feedback Resolution feedback
 */
export function recordResolution(feedback: ResolutionFeedback): void {
  const errorSignature = feedback.errorSignature
  learningStore.recordAttempt(
    feedback.solutionId,
    errorSignature,
    feedback.successful,
    feedback.expertiseLevel,
    feedback.context,
  )

  logger.info('Resolution recorded', {
    solutionId: feedback.solutionId,
    successful: feedback.successful,
    errorSignature,
  })
}

/**
 * Get the overall recovery success rate.
 * Used to verify the 80% success rate acceptance criterion.
 */
export function getRecoveryStats(): {
  totalAttempts: number
  totalSuccesses: number
  successRate: number
  byCategory: Record<string, { attempts: number; successes: number; rate: number }>
} {
  const records = learningStore.getAll()
  const totalAttempts = records.reduce((sum, r) => sum + r.attempts, 0)
  const totalSuccesses = records.reduce((sum, r) => sum + r.successes, 0)

  // Group by solution category (derive from solution ID prefix)
  const byCategory: Record<string, { attempts: number; successes: number; rate: number }> = {}
  for (const record of records) {
    // Extract category from error signature (format: "category::message")
    const category = record.errorSignature.split('::')[0] || 'unknown'
    if (!byCategory[category]) {
      byCategory[category] = { attempts: 0, successes: 0, rate: 0 }
    }
    byCategory[category].attempts += record.attempts
    byCategory[category].successes += record.successes
  }

  for (const cat of Object.keys(byCategory)) {
    const c = byCategory[cat]
    c.rate = c.attempts > 0 ? c.successes / c.attempts : 0
  }

  return {
    totalAttempts,
    totalSuccesses,
    successRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
    byCategory,
  }
}

/**
 * Clear all learning data.
 */
export function clearLearningData(): void {
  learningStore.clearAll()
  logger.info('Learning data cleared')
}

/**
 * Get all available solutions (for debugging or UI).
 */
export function getAllSolutions(): Solution[] {
  return [...SOLUTION_DB]
}

/**
 * Get a specific solution by ID.
 */
export function getSolutionById(id: string): Solution | undefined {
  return SOLUTION_DB.find((s) => s.id === id)
}

export { ERROR_CATEGORIES, ERROR_SEVERITY }
export type { ErrorCategory, ErrorSeverity }
