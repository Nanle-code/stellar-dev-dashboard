/**
 * codeReview/stellarBestPractices.ts
 *
 * Stellar-specific best practice recommendations for the code review
 * assistant. Provides actionable recommendations covering Stellar Core,
 * Soroban smart contracts, Horizon API, and SDK usage patterns.
 */

import type { BestPracticeRecommendation, SourceFile } from './types';

// ─── Stellar Best Practice Database ──────────────────────────────────────────

const BEST_PRACTICES: BestPracticeRecommendation[] = [
  // === STELLAR CORE ===
  {
    id: 'stellar-core-1',
    title: 'Always use StrKey for address validation',
    description:
      'Use `StellarSdk.StrKey.isValidEd25519PublicKey()` to validate all Stellar public keys before using them. This catches typos and incorrect address formats early.',
    domain: 'stellar-core',
    priority: 'essential',
    goodExample: [
      'if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {',
      '  throw new Error(`Invalid Stellar address: ${address}`);',
      '}',
    ].join('\n'),
    badExample: [
      '// Unsafe: no validation before use',
      'const account = await server.loadAccount(address);',
    ].join('\n'),
    docReference: 'https://stellar.github.io/js-stellar-sdk/StrKey.html',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'stellar-core-2',
    title: 'Fetch fresh sequence number for each transaction',
    description:
      'Always call `server.loadAccount()` immediately before building a transaction to get the current sequence number. Stale sequence numbers cause transaction failures.',
    domain: 'stellar-core',
    priority: 'essential',
    goodExample: [
      'const account = await server.loadAccount(publicKey);',
      'const tx = new StellarSdk.TransactionBuilder(account, {',
      '  fee: StellarSdk.BASE_FEE,',
      '  networkPassphrase: StellarSdk.Networks.TESTNET,',
      '})',
      '  .addOperation(StellarSdk.Operation.payment({...}))',
      '  .setTimeout(30)',
      '  .build();',
    ].join('\n'),
    badExample: [
      '// sequence number may be stale if fetched earlier',
      'const tx = new StellarSdk.TransactionBuilder(cachedAccount, {',
      '  ...',
      '}).build();',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/learn/fundamentals/stellar-data-structures/transactions',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'stellar-core-3',
    title: 'Set appropriate transaction timeouts',
    description:
      'Always call `.setTimeout()` on transactions to prevent them from being valid indefinitely. Use 30 seconds for most cases, or longer for complex multi-sig flows.',
    domain: 'stellar-core',
    priority: 'essential',
    goodExample: '.setTimeout(30)',
    badExample: '.setTimeout(0) // Valid forever — dangerous!',
    docReference: 'https://stellar.github.io/js-stellar-sdk/TransactionBuilder.html#.setTimeout',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'stellar-core-4',
    title: 'Handle transaction result codes properly',
    description:
      'Always check `result.resultCodes` after submitting a transaction. Each operation has a specific result code that indicates success or failure mode.',
    domain: 'stellar-core',
    priority: 'essential',
    goodExample: [
      'try {',
      '  const result = await server.submitTransaction(tx);',
      '  if (result.operationResultCodes) {',
      '    console.log(\'Transaction succeeded:\', result.hash);',
      '  }',
      '} catch (error) {',
      '  const resultCodes = error?.response?.data?.extras?.result_codes;',
      '  if (resultCodes) {',
      '    handleTransactionFailure(resultCodes.operations);',
      '  }',
      '}',
    ].join('\n'),
    badExample: [
      '// Ignoring result codes — silent failures!',
      'const result = await server.submitTransaction(tx);',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/learn/errors',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },

  // === SOROBAN ===
  {
    id: 'soroban-1',
    title: 'Use proper Soroban resource estimation',
    description:
      'Always use `simulateTransaction` to estimate Soroban resource usage (instructions, read/write entries) before submitting. Set appropriate resource limits in the transaction.',
    domain: 'soroban',
    priority: 'essential',
    goodExample: [
      'const simulation = await sorobanServer.simulateTransaction(tx);',
      'if (simulation.result) {',
      '  tx.setSorobanData(simulation.minResourceFee, simulation.transactionData);',
      '}',
    ].join('\n'),
    docReference: 'https://soroban.stellar.org/docs/how-to-guides/simulate-transaction',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'soroban-2',
    title: 'Handle Soroban contract invocation errors gracefully',
    description:
      'Soroban contract calls can fail for many reasons: insufficient resources, contract errors, auth failures. Always wrap invocations in try/catch with specific error handling.',
    domain: 'soroban',
    priority: 'essential',
    goodExample: [
      'try {',
      '  const result = await sorobanServer.sendTransaction(tx);',
      '  if (result.status === \'SUCCESS\') {',
      '    return result;',
      '  }',
      '  throw new SorobanError(`Contract call failed: ${result.error}`);',
      '} catch (err) {',
      '  if (err.code === \'txn_insufficient_fee\') {',
      '    await retryWithHigherFee(tx);',
      '  }',
      '}',
    ].join('\n'),
    docReference: 'https://soroban.stellar.org/docs/how-to-guides/errors',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'soroban-3',
    title: 'Use Soroban contract spec types for type safety',
    description:
      'Define TypeScript types matching your Soroban contract spec (functions, parameters, return types). This prevents runtime errors from type mismatches.',
    domain: 'soroban',
    priority: 'recommended',
    goodExample: [
      '// Define contract interface matching the .rs spec',
      'interface SwapContract {',
      '  swap(params: SwapParams): Promise<SwapResult>;',
      '  getPool(address: string): Promise<PoolInfo>;',
      '}',
    ].join('\n'),
    docReference: 'https://soroban.stellar.org/docs/reference/interfaces',
    appliesTo: ['*.ts', '*.tsx'],
  },

  // === HORIZON ===
  {
    id: 'horizon-1',
    title: 'Use streaming (SSE) for real-time updates',
    description:
      'Instead of polling Horizon, use Server-Sent Events (SSE) via `.payments()`, `.operations()`, or `.transactions()` streaming for real-time updates. This reduces load on both client and server.',
    domain: 'horizon',
    priority: 'recommended',
    goodExample: [
      'const stream = server.payments()',
      '  .forAccount(accountId)',
      '  .cursor(\'now\')',
      '  .stream({',
      '    onmessage: (payment) => handlePayment(payment),',
      '    onerror: (err) => console.error(\'Stream error:\', err),',
      '  });',
      '',
      '// Later:',
      'stream(); // Close the stream',
    ].join('\n'),
    badExample: [
      '// Polling — inefficient and rate-limited',
      'setInterval(async () => {',
      '  const payments = await server.payments().forAccount(id).call();',
      '}, 5000);',
    ].join('\n'),
    docReference: 'https://stellar.github.io/js-stellar-sdk/CallBuilder.html#.stream',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'horizon-2',
    title: 'Implement proper rate limiting and retry logic',
    description:
      'Horizon has rate limits (default ~3600 requests/hour). Implement exponential backoff, request queuing, and handle 429 responses gracefully.',
    domain: 'horizon',
    priority: 'recommended',
    goodExample: [
      'async function fetchWithRetry(url, retries = 3) {',
      '  for (let i = 0; i < retries; i++) {',
      '    try {',
      '      return await fetch(url);',
      '    } catch (err) {',
      '      if (err.status === 429) {',
      '        await delay(Math.pow(2, i) * 1000);',
      '        continue;',
      '      }',
      '      throw err;',
      '    }',
      '  }',
      '}',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/horizon/rate-limiting',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'horizon-3',
    title: 'Handle Horizon/Soroban RPC endpoint errors',
    description:
      'Horizon and Soroban RPC can return errors for transient issues. Always check response status codes and retry with backoff on 5xx and connection errors.',
    domain: 'horizon',
    priority: 'essential',
    goodExample: [
      'if (response.status >= 500) {',
      '  // Server error — retry with backoff',
      '  await delay(2000);',
      '  return makeRequest();',
      '}',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/horizon/errors',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },

  // === SDK ===
  {
    id: 'sdk-1',
    title: 'Use modern Stellar SDK async/await patterns',
    description:
      'The modern Stellar SDK fully supports async/await. Avoid callback patterns and use `await server.loadAccount()` consistently for better error handling.',
    domain: 'sdk',
    priority: 'recommended',
    goodExample: 'const account = await server.loadAccount(publicKey);',
    badExample: 'server.loadAccount(publicKey).then(acct => {...}).catch(err => {...});',
    docReference: 'https://stellar.github.io/js-stellar-sdk/',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'sdk-2',
    title: 'Always specify network passphrase explicitly',
    description:
      'Always pass `networkPassphrase` when building transactions instead of relying on defaults. This prevents testnet transactions from being submitted to mainnet and vice versa.',
    domain: 'sdk',
    priority: 'essential',
    goodExample: 'networkPassphrase: network === \'mainnet\' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET',
    badExample: '// Missing network passphrase — may default incorrectly',
    docReference: 'https://stellar.github.io/js-stellar-sdk/TransactionBuilder.html',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'sdk-3',
    title: 'Use memo for transaction identification',
    description:
      'Use `TransactionBuilder.addMemo()` for all user-facing transactions. Memos are essential for exchanges and payment processors to correlate transactions with user accounts.',
    domain: 'sdk',
    priority: 'recommended',
    goodExample: [
      '.addMemo(StellarSdk.Memo.text(`DEPOSIT-${userId}`))',
    ].join('\n'),
    badExample: [
      '// No memo — cannot correlate with user accounts',
    ].join('\n'),
    docReference: 'https://stellar.github.io/js-stellar-sdk/Memo.html',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },

  // === GENERAL ===
  {
    id: 'general-1',
    title: 'Test on Testnet before deploying to Mainnet',
    description:
      'Always test Stellar transactions and Soroban contracts on Testnet first. Testnet has a faucet for free XLM and behaves identically to Mainnet.',
    domain: 'general',
    priority: 'essential',
    goodExample: [
      'if (network === \'mainnet\') {',
      '  throw new Error(\'Not implemented for mainnet yet. Test on testnet first.\');',
      '}',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/learn/network',
    appliesTo: ['*'],
  },
  {
    id: 'general-2',
    title: 'Use environment variables for network configuration',
    description:
      'Store Horizon URLs, Soroban RPC endpoints, and network passphrases in environment variables, not hardcoded in source. Use `.env` files with `.env.example` for documentation.',
    domain: 'general',
    priority: 'recommended',
    goodExample: [
      'const HORIZON_URL = process.env.STELLAR_HORIZON_URL;',
      'const SOROBAN_URL = process.env.STELLAR_SOROBAN_RPC_URL;',
    ].join('\n'),
    badExample: [
      'const HORIZON_URL = \'https://horizon-testnet.stellar.org\';  // Hardcoded!',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/learn/configuration',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'general-3',
    title: 'Implement proper reserve requirements handling',
    description:
      'Stellar accounts require a minimum XLM balance (reserve) that increases with each entry (trustline, offer, signer). Calculate reserves before performing operations.',
    domain: 'general',
    priority: 'recommended',
    goodExample: [
      'const BASE_RESERVE = 0.5; // XLM',
      'const entryCount = trustlines.length + offers.length + signers.length;',
      'const requiredReserve = BASE_RESERVE * (2 + entryCount);',
      'if (balance < requiredReserve) {',
      '  throw new Error(`Insufficient reserve: need ${requiredReserve} XLM, have ${balance}`);',
      '}',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/learn/fundamentals/lumens',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'general-4',
    title: 'Use multisig for high-value accounts',
    description:
      'For production accounts holding significant value, configure multi-signature with appropriate thresholds. This prevents single-key compromise from losing funds.',
    domain: 'general',
    priority: 'suggested',
    goodExample: [
      '// Set up 2-of-3 multisig',
      'const tx = new StellarSdk.TransactionBuilder(account, {...})',
      '  .addOperation(StellarSdk.Operation.setOptions({',
      '    masterWeight: 1,',
      '    lowThreshold: 2,',
      '    medThreshold: 2,',
      '    highThreshold: 2,',
      '    signer: { ed25519PublicKey: backupKey, weight: 1 },',
      '  }))',
      '  .setTimeout(30)',
      '  .build();',
    ].join('\n'),
    docReference: 'https://stellar.org/docs/learn/glossary/multisig',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
  {
    id: 'general-5',
    title: 'Claimable balances for non-atomic payments',
    description:
      'Use claimable balances (`StellarSdk.Operation.createClaimableBalance`) for payments where the recipient may not be ready to receive immediately. This avoids payment failures.',
    domain: 'general',
    priority: 'suggested',
    goodExample: [
      'const tx = new StellarSdk.TransactionBuilder(account, {...})',
      '  .addOperation(StellarSdk.Operation.createClaimableBalance({',
      '    asset: StellarSdk.Asset.native(),',
      '    amount: \'100\',',
      '    claimants: [',
      '      new StellarSdk.Claimant(recipientKey,',
      '        StellarSdk.Predicate.predicateNot(',
      '          StellarSdk.Predicate.predicateBeforeRelativeTime(\'86400\')',
      '        )',
      '      ),',
      '    ],',
      '  }))',
      '  .setTimeout(30)',
      '  .build();',
    ].join('\n'),
    docReference: 'https://stellar.github.io/js-stellar-sdk/Operation.html#.createClaimableBalance',
    appliesTo: ['*.ts', '*.js', '*.tsx', '*.jsx'],
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all Stellar best practice recommendations.
 */
export function getAllBestPractices(): BestPracticeRecommendation[] {
  return [...BEST_PRACTICES];
}

/**
 * Get recommendations filtered by domain.
 */
export function getBestPracticesByDomain(
  domain: BestPracticeRecommendation['domain']
): BestPracticeRecommendation[] {
  return BEST_PRACTICES.filter((bp) => bp.domain === domain);
}

/**
 * Get recommendations by priority.
 */
export function getBestPracticesByPriority(
  priority: BestPracticeRecommendation['priority']
): BestPracticeRecommendation[] {
  return BEST_PRACTICES.filter((bp) => bp.priority === priority);
}

/**
 * Get recommendations relevant to a set of files.
 */
export function getRelevantBestPractices(
  files: SourceFile[]
): BestPracticeRecommendation[] {
  const fileExtensions = new Set(files.map((f) => {
    const ext = f.path.match(/\.\w+$/)?.[0];
    return ext || '';
  }));

  return BEST_PRACTICES.filter((bp) => {
    return bp.appliesTo.some((pattern) => {
      if (pattern === '*') return true;
      return fileExtensions.has(pattern);
    });
  });
}

/**
 * Check files against best practices and return those that are likely violated.
 */
export function checkBestPracticesViolations(
  files: SourceFile[]
): BestPracticeRecommendation[] {
  const violations: BestPracticeRecommendation[] = [];
  const relevant = getRelevantBestPractices(files);

  for (const bp of relevant) {
    for (const file of files) {
      const src = file.source;

      // Check for bad patterns in the source
      switch (bp.id) {
        case 'stellar-core-1': {
          // Check if addresses are used without StrKey validation
          if (
            /['"](G[A-Z0-9]{55})['"]/.test(src) &&
            !/StrKey\.isValidEd25519PublicKey/.test(src)
          ) {
            violations.push({ ...bp, description: `File ${file.path} uses Stellar addresses but missing StrKey validation.` });
          }
          break;
        }
        case 'sdk-2': {
          // Check if transactions are built without explicit network passphrase
          if (
            /TransactionBuilder/.test(src) &&
            !/networkPassphrase/.test(src)
          ) {
            violations.push({ ...bp, description: `File ${file.path} uses TransactionBuilder but missing explicit networkPassphrase.` });
          }
          break;
        }
        case 'horizon-1': {
          // Check if polling is used instead of streaming
          if (
            /\.payments\(\)\.call\(/.test(src) &&
            !/\.payments\(\)\.stream\(/.test(src)
          ) {
            violations.push({ ...bp, description: `File ${file.path} uses polling instead of streaming for real-time updates.` });
          }
          break;
        }
        case 'general-2': {
          // Check if URLs are hardcoded
          if (
            /(horizon|soroban|rpc)Url\s*[:=]\s*['"]https?:/.test(src) &&
            !/process\.env/.test(src)
          ) {
            violations.push({ ...bp, description: `File ${file.path} contains hardcoded network URLs.` });
          }
          break;
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = v.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
