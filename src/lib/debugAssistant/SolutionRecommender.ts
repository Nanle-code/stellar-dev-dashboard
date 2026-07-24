import * as tf from '@tensorflow/tfjs';
import { getSimilarFixes, recordFix, updateFixHelpful, type FixRecord } from './FixHistoryStore';
import { formatErrorMessage } from '../../utils/errorHandler';

export interface RecommendedSolution {
  id: string;
  title: string;
  description: string;
  steps: string[];
  confidence: number;
  source: 'ml' | 'pattern' | 'historical' | 'heuristic';
  effort: 'low' | 'medium' | 'high';
  autoFixAvailable: boolean;
  relatedDocs: { label: string; url: string }[];
}

interface SolutionTemplate {
  pattern: RegExp;
  title: string;
  description: string;
  steps: string[];
  effort: 'low' | 'medium' | 'high';
  autoFixAvailable: boolean;
  relatedDocs: { label: string; url: string }[];
}

const SOLUTION_TEMPLATES: SolutionTemplate[] = [
  {
    pattern: /account.*(not found|does not exist)/i,
    title: 'Create or Fund Account',
    description: 'The Stellar account does not exist on the selected network. Accounts must be funded with at least the minimum balance before they can perform operations.',
    steps: [
      'Use the Faucet tab to fund the account on Testnet',
      'On Mainnet, send at least 1 XLM from an existing account using a createAccount operation',
      'Verify the network selection (Testnet vs Mainnet) matches where the account was created',
    ],
    effort: 'low',
    autoFixAvailable: true,
    relatedDocs: [
      { label: 'Account Creation', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts' },
      { label: 'Testnet Faucet', url: 'https://developers.stellar.org/docs/tools/horizon/api-reference/getting-started/quickstart' },
    ],
  },
  {
    pattern: /insufficient.*(balance|fund)/i,
    title: 'Increase Account Balance',
    description: 'The account does not have enough XLM to complete this operation. Each additional entry (trustline, offer) increases the minimum balance requirement.',
    steps: [
      'Check the minimum balance: 1 XLM base reserve + 0.5 XLM per subentry',
      'View current balance and subentries in the Account panel',
      'Remove unnecessary trustlines or offers to reduce the minimum balance',
      'Send additional XLM to the account',
    ],
    effort: 'medium',
    autoFixAvailable: false,
    relatedDocs: [
      { label: 'Minimum Balance', url: 'https://developers.stellar.org/docs/learn/fundamentals/fees-and-network' },
    ],
  },
  {
    pattern: /rate.?limit/i,
    title: 'Implement Request Throttling',
    description: 'You are being rate-limited by the Horizon or Soroban RPC server. Back off and retry with exponential delay.',
    steps: [
      'Wait 5-10 seconds before sending another request',
      'Implement exponential backoff with jitter for retries',
      'Use the streaming (SSE) API instead of polling for ledger data',
      'Consider running your own Horizon node for high-throughput workloads',
    ],
    effort: 'medium',
    autoFixAvailable: false,
    relatedDocs: [
      { label: 'Rate Limiting Guide', url: 'https://developers.stellar.org/docs/data/horizon/api-reference/rate-limiting' },
    ],
  },
  {
    pattern: /(timeout|timed.?out)/i,
    title: 'Increase Request Timeout',
    description: 'The request to Horizon or Soroban RPC timed out. This may indicate network congestion or connectivity issues.',
    steps: [
      'Increase the timeout value in your Stellar SDK configuration',
      'Check your internet connection stability',
      'The network may be congested — retry with a higher fee',
      'Use the streaming API for real-time data instead of blocking requests',
    ],
    effort: 'low',
    autoFixAvailable: false,
    relatedDocs: [
      { label: 'Connection Troubleshooting', url: 'https://developers.stellar.org/docs/troubleshooting' },
    ],
  },
  {
    pattern: /sequence.*(number|bad|incorrect)/i,
    title: 'Refresh Account Sequence Number',
    description: 'The transaction sequence number does not match the current account sequence. This happens when multiple transactions are submitted without waiting for confirmation.',
    steps: [
      'Refresh the account data to get the current sequence number',
      'Implement transaction queue management with sequential submission',
      'After each successful transaction, increment the sequence number',
      'Use the account\'s sequence number directly from Horizon, not a cached value',
    ],
    effort: 'low',
    autoFixAvailable: true,
    relatedDocs: [
      { label: 'Sequence Numbers', url: 'https://developers.stellar.org/docs/learn/encyclopedia/transactions' },
    ],
  },
  {
    pattern: /(tx_bad_auth|bad.*auth|unauthorized)/i,
    title: 'Fix Transaction Authorization',
    description: 'The transaction authorization failed. This is often due to incorrect signing or missing signatures.',
    steps: [
      'Connect your wallet using the Wallet Connect panel',
      'Verify the correct account is selected in your wallet',
      'Check that the wallet is on the correct network (Testnet/Mainnet)',
      'Ensure the signing key has sufficient threshold weight for the operation',
    ],
    effort: 'low',
    autoFixAvailable: false,
    relatedDocs: [
      { label: 'Signatures and Multisig', url: 'https://developers.stellar.org/docs/learn/encyclopedia/signatures-multisig' },
    ],
  },
  {
    pattern: /(horizon|server).*(error|unavailable|down)/i,
    title: 'Check Stellar Network Status',
    description: 'The Horizon server is reporting errors or is unavailable. This may be due to maintenance or network issues.',
    steps: [
      'Check https://status.stellar.org for service status',
      'Wait a few minutes and retry the operation',
      'Switch to a different Horizon endpoint or network',
      'If using a custom endpoint, verify it is running and accessible',
    ],
    effort: 'low',
    autoFixAvailable: false,
    relatedDocs: [
      { label: 'Network Status', url: 'https://status.stellar.org/' },
    ],
  },
  {
    pattern: /(soroban|contract).*(not found|does not exist)/i,
    title: 'Verify Contract Deployment',
    description: 'The Soroban contract could not be found on the selected network. The contract may not be deployed or the ID may be incorrect.',
    steps: [
      'Verify the contract ID starts with "C" and is 56 characters',
      'Confirm the contract is deployed on the current network',
      'Use the Contract Interaction panel to inspect the contract',
      'Re-deploy the contract if necessary',
    ],
    effort: 'medium',
    autoFixAvailable: false,
    relatedDocs: [
      { label: 'Soroban Contracts', url: 'https://developers.stellar.org/docs/soroban/contracts' },
    ],
  },
  {
    pattern: /(fee|base.?fee).*(high|low|insufficient)/i,
    title: 'Adjust Transaction Fee',
    description: 'The transaction fee is not appropriate for the current network conditions.',
    steps: [
      'Check current fee stats in the Network Stats panel',
      'Use the recommended fee from the fee intelligence data',
      'Set base fee higher during periods of network congestion',
      'For time-sensitive transactions, use a higher fee to ensure prompt processing',
    ],
    effort: 'low',
    autoFixAvailable: true,
    relatedDocs: [
      { label: 'Fees and Network', url: 'https://developers.stellar.org/docs/learn/fundamentals/fees-and-network' },
    ],
  },
  {
    pattern: /(cors|network.*error|fetch)/i,
    title: 'Check CORS Configuration',
    description: 'A network request failed due to CORS policy or network connectivity issues.',
    steps: [
      'Ensure you are using the correct Horizon/Soroban RPC URLs',
      'For custom endpoints, verify CORS headers are properly configured',
      'Check browser extensions that may block requests',
      'Try using a different network endpoint',
    ],
    effort: 'medium',
    autoFixAvailable: false,
    relatedDocs: [
      { label: 'Horizon API Reference', url: 'https://developers.stellar.org/docs/data/horizon/api-reference' },
    ],
  },
];

let model: tf.LayersModel | null = null;

async function loadRecommendationModel(): Promise<tf.LayersModel | null> {
  if (model) return model;
  try {
    model = await tf.loadLayersModel('indexeddb://stellar-debug-model');
    return model;
  } catch {
    return null;
  }
}

function extractFeatures(errorMessage: string, category: string): tf.Tensor2D {
  const features: number[] = [];
  const categories = ['network', 'validation', 'stellar', 'authentication', 'permission', 'rate_limit', 'unknown'];
  const categoryOneHot = categories.map((c) => (c === category ? 1 : 0));
  features.push(...categoryOneHot);

  const keywords = ['timeout', 'balance', 'auth', 'fee', 'sequence', 'rate', 'cors', 'contract', 'horizon', 'soroban'];
  const keywordFeatures = keywords.map((kw) => (errorMessage.toLowerCase().includes(kw) ? 1 : 0));
  features.push(...keywordFeatures);

  features.push(errorMessage.length / 500);
  features.push(errorMessage.split(' ').length / 50);

  return tf.tensor2d([features]);
}

export async function getRecommendations(
  error: unknown,
  category: string,
  context: string = 'unknown',
): Promise<RecommendedSolution[]> {
  const errorMessage = formatErrorMessage(error);
  const recommendations: RecommendedSolution[] = [];

  const templateMatches = findTemplateMatches(errorMessage);
  recommendations.push(...templateMatches);

  const historicalFixes = await getHistoricalRecommendations(errorMessage, category);
  for (const hist of historicalFixes) {
    if (!recommendations.some((r) => r.title === hist.title)) {
      recommendations.push(hist);
    }
  }

  const mlRecommendations = await getMlRecommendations(errorMessage, category);
  for (const ml of mlRecommendations) {
    if (!recommendations.some((r) => r.title === ml.title)) {
      recommendations.push(ml);
    }
  }

  recommendations.sort((a, b) => b.confidence - a.confidence);
  return recommendations.slice(0, 5);
}

function findTemplateMatches(errorMessage: string): RecommendedSolution[] {
  const matches: RecommendedSolution[] = [];
  const normalizedMessage = errorMessage.toLowerCase();

  for (const template of SOLUTION_TEMPLATES) {
    if (template.pattern.test(normalizedMessage)) {
      matches.push({
        id: `pattern-${matches.length}`,
        title: template.title,
        description: template.description,
        steps: template.steps,
        confidence: 0.85,
        source: 'pattern',
        effort: template.effort,
        autoFixAvailable: template.autoFixAvailable,
        relatedDocs: template.relatedDocs,
      });
    }
  }

  return matches;
}

async function getHistoricalRecommendations(
  errorMessage: string,
  category: string,
): Promise<RecommendedSolution[]> {
  const similarFixes = await getSimilarFixes(errorMessage, category, 5);
  const helpfulFixes = similarFixes.filter((f) => f.wasHelpful === true);

  if (helpfulFixes.length === 0) return [];

  const solutionCounts: Record<string, { count: number; fix: FixRecord }> = {};
  for (const fix of helpfulFixes) {
    if (!solutionCounts[fix.solution]) {
      solutionCounts[fix.solution] = { count: 0, fix };
    }
    solutionCounts[fix.solution].count += 1;
  }

  return Object.entries(solutionCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([solution, data], index) => ({
      id: `historical-${index}`,
      title: `Previously Successful: ${solution.slice(0, 60)}`,
      description: `This solution resolved a similar issue ${data.count} time(s) before`,
      steps: [solution],
      confidence: Math.min(0.5 + data.count * 0.15, 0.95),
      source: 'historical' as const,
      effort: 'medium' as const,
      autoFixAvailable: false,
      relatedDocs: [],
    }));
}

async function getMlRecommendations(
  errorMessage: string,
  category: string,
): Promise<RecommendedSolution[]> {
  const mlModel = await loadRecommendationModel();
  if (!mlModel) return [];

  try {
    const features = extractFeatures(errorMessage, category);
    const prediction = mlModel.predict(features) as tf.Tensor;
    const values = await prediction.data();
    features.dispose();
    prediction.dispose();

    const solutionLabels = [
      'Retry the operation after refreshing account data',
      'Adjust fee or network configuration',
      'Verify input parameters and credentials',
      'Use an alternative endpoint or network',
      'Wait for network conditions to improve',
    ];

    const results = Array.from(values)
      .map((v, i) => ({ label: solutionLabels[i] || solutionLabels[0], confidence: v }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2);

    return results.map((r, i) => ({
      id: `ml-${i}`,
      title: r.label,
      description: `ML model recommendation with ${Math.round(r.confidence * 100)}% confidence`,
      steps: [r.label],
      confidence: r.confidence,
      source: 'ml' as const,
      effort: 'medium' as const,
      autoFixAvailable: false,
      relatedDocs: [],
    }));
  } catch {
    return [];
  }
}

export async function recordSolutionFeedback(
  errorMessage: string,
  category: string,
  context: string,
  solution: string,
  wasHelpful: boolean,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const id = await recordFix({
    errorMessage,
    errorCategory: category,
    errorFingerprint: `${category}:${errorMessage.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)}`,
    context,
    solution,
    solutionSource: 'pattern',
    wasHelpful,
    resolvedAt: wasHelpful ? new Date().toISOString() : null,
    duration: 0,
    network: metadata.network as string || 'unknown',
    activeTab: metadata.activeTab as string || 'unknown',
    metadata,
  });

  if (wasHelpful) {
    await trainModel(errorMessage, category, solution);
  }

  return id;
}

async function trainModel(
  _errorMessage: string,
  _category: string,
  _solution: string,
): Promise<void> {
  try {
    const fixes = await getSimilarFixes(_errorMessage, _category, 50);
    const helpful = fixes.filter((f) => f.wasHelpful === true);
    if (helpful.length < 10) return;

    const xs: number[][] = [];
    const ys: number[][] = [];

    for (const fix of helpful) {
      const features = extractFeatures(fix.errorMessage, fix.errorCategory);
      xs.push(Array.from(await features.data()));
      features.dispose();
      ys.push([0.9]);
    }

    if (xs.length < 10) return;

    let currentModel = await loadRecommendationModel();
    if (!currentModel) {
      currentModel = tf.sequential();
      currentModel.add(
        tf.layers.dense({ units: 16, activation: 'relu', inputShape: [xs[0].length] }),
      );
      currentModel.add(tf.layers.dropout({ rate: 0.2 }));
      currentModel.add(tf.layers.dense({ units: 8, activation: 'relu' }));
      currentModel.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
      currentModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      });
    }

    const xTensor = tf.tensor2d(xs);
    const yTensor = tf.tensor2d(ys);

    await currentModel.fit(xTensor, yTensor, {
      epochs: 5,
      batchSize: Math.min(xs.length, 16),
      shuffle: true,
      callbacks: {
        onEpochEnd: (_epoch, logs) => {
          if (logs) {
            console.debug(`[DebugAssistant] Training epoch ${_epoch}: loss=${logs.loss.toFixed(4)}`);
          }
        },
      },
    });

    xTensor.dispose();
    yTensor.dispose();

    await currentModel.save('indexeddb://stellar-debug-model');
    model = currentModel;
  } catch (err) {
    console.warn('[DebugAssistant] Model training failed:', err);
  }
}
