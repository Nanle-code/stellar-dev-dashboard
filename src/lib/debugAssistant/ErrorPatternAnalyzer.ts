import * as tf from '@tensorflow/tfjs';
import { categorizeError, formatErrorMessage } from '../../utils/errorHandler';
import { detectAnomalies } from '../../utils/metricsCollector';
import { generateFingerprint, getPatternsByCategory, getSimilarFixes } from './FixHistoryStore';

export interface AnalysisResult {
  fingerprint: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  isRecurring: boolean;
  frequency: number;
  anomalyScore: number;
  similarPastIncidents: number;
  resolvedRate: number;
  temporalPattern: TemporalPattern;
  mlInsights: string[];
  suggestedActions: string[];
}

export type TemporalPattern = 'spike' | 'recurring' | 'new' | 'intermittent' | 'persistent';

const STELLAR_PATTERN_SCORES: Record<string, { confidence: number; actions: string[] }> = {
  'account not found': {
    confidence: 0.95,
    actions: [
      'Verify the public key is correct and includes the full G... address',
      'Ensure the account has been created on the selected network',
      'Fund the account using the Faucet (Testnet) or create it with a createAccount operation',
    ],
  },
  'insufficient balance': {
    confidence: 0.9,
    actions: [
      'Check your XLM minimum balance requirement (base reserve + subentries)',
      'Reduce the number of subentries (trustlines/offers) to free up XLM',
      'Fund the account with additional XLM',
    ],
  },
  'transaction failed': {
    confidence: 0.85,
    actions: [
      'Check the transaction result codes for specific failure reasons',
      'Verify the sequence number matches the current account sequence',
      'Ensure the fee is sufficient for the current network conditions',
    ],
  },
  'rate limit': {
    confidence: 0.95,
    actions: [
      'Reduce request frequency — add delays between API calls',
      'Implement exponential backoff for retries',
      'Consider using the streaming API instead of polling',
    ],
  },
  'timeout': {
    confidence: 0.8,
    actions: [
      'Check your network connection stability',
      'Increase the request timeout in Horizon/ Soroban RPC configuration',
      'The network may be congested — retry with higher fee',
    ],
  },
  'horizon server': {
    confidence: 0.75,
    actions: [
      'Check Stellar network status at https://status.stellar.org',
      'The Horizon server may be undergoing maintenance',
      'Switch to a different network or a custom Horizon endpoint',
    ],
  },
  'soroban rpc': {
    confidence: 0.75,
    actions: [
      'Verify the contract ID is valid and deployed on the current network',
      'Check that the Soroban RPC endpoint is reachable',
      'Ensure the contract function name and arguments are correct',
    ],
  },
  'invalid public key': {
    confidence: 0.95,
    actions: [
      'Stellar public keys start with G and are 56 characters long',
      'Use StrKey.isValidEd25519PublicKey() to validate before submitting',
      'Check for copy-paste errors or extra whitespace',
    ],
  },
  'unauthorized': {
    confidence: 0.85,
    actions: [
      'Connect your wallet (Freighter or Ledger) to authorize transactions',
      'Check that the wallet is unlocked and on the correct network',
      'You may lack signing authority for this account',
    ],
  },
  'forbidden': {
    confidence: 0.85,
    actions: [
      'The account has auth_required flag enabled',
      'Only authorized accounts can hold this asset',
      'Contact the asset issuer to authorize your account',
    ],
  },
};

const PATTERN_CACHE = new Map<string, { result: AnalysisResult; timestamp: number }>();
const CACHE_TTL = 30_000;

export async function analyzeError(
  error: unknown,
  context: string = 'unknown',
  network: string = 'testnet',
  activeTab: string = 'overview',
): Promise<AnalysisResult> {
  const errorMessage = formatErrorMessage(error);
  const { category, severity } = categorizeError(error);
  const fingerprint = generateFingerprint(errorMessage, category);
  const cacheKey = `${fingerprint}:${context}`;
  const cached = PATTERN_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const patternData = await getPatternsByCategory(category);
  const similarFixes = await getSimilarFixes(errorMessage, category, 10);
  const matchingPattern = patternData.find((p) => p.fingerprint === fingerprint);

  const frequency = matchingPattern?.frequency ?? 0;
  const resolvedRate = matchingPattern?.resolvedRate ?? 0;
  const isRecurring = frequency > 1;
  const similarPastIncidents = similarFixes.length;

  const anomalyScore = computeAnomalyScore(errorMessage, category, frequency);
  const temporalPattern = classifyTemporal(frequency, similarPastIncidents);
  const mlInsights = generateMlInsights(errorMessage, category, frequency, anomalyScore);
  const confidence = computeConfidence(errorMessage, category, frequency, resolvedRate, anomalyScore);
  const suggestedActions = getSuggestedActions(errorMessage, category, similarFixes);

  const result: AnalysisResult = {
    fingerprint,
    category,
    severity,
    confidence,
    isRecurring,
    frequency,
    anomalyScore,
    similarPastIncidents,
    resolvedRate,
    temporalPattern,
    mlInsights,
    suggestedActions,
  };

  PATTERN_CACHE.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}

function computeAnomalyScore(errorMessage: string, _category: string, frequency: number): number {
  const anomalies = detectAnomalies(10, 2.0);
  const maxZScore = anomalies.length > 0
    ? Math.max(...anomalies.map((a) => a.zScore))
    : 0;
  const anomalyWeight = Math.min(maxZScore / 5, 1) * 40;
  const frequencyWeight = Math.min(frequency * 10, 30);
  const severityWeight = computeMessageSeverity(errorMessage) * 30;
  return Math.min(Math.round(anomalyWeight + frequencyWeight + severityWeight), 100);
}

function computeMessageSeverity(errorMessage: string): number {
  const critical = ['security', 'authenticate', 'breach', 'compromise', 'bank'];
  const high = ['fail', 'error', 'exception', 'crash', 'timeout', 'unavailable'];
  const medium = ['invalid', 'not found', 'denied', 'limit', 'rejected'];
  const msg = errorMessage.toLowerCase();
  if (critical.some((w) => msg.includes(w))) return 1;
  if (high.some((w) => msg.includes(w))) return 0.6;
  if (medium.some((w) => msg.includes(w))) return 0.3;
  return 0.1;
}

function classifyTemporal(frequency: number, similarPastIncidents: number): TemporalPattern {
  if (frequency === 0 && similarPastIncidents === 0) return 'new';
  if (frequency >= 5) return 'recurring';
  if (frequency >= 3) return 'persistent';
  if (similarPastIncidents > 0 && frequency <= 1) return 'intermittent';
  if (frequency <= 2 && similarPastIncidents > 0) return 'spike';
  return 'new';
}

function generateMlInsights(
  errorMessage: string,
  category: string,
  frequency: number,
  anomalyScore: number,
): string[] {
  const insights: string[] = [];

  if (frequency > 0) {
    insights.push(`This error pattern has been observed ${frequency} time(s) before`);
  }
  if (anomalyScore > 50) {
    insights.push(`Anomaly score is high (${anomalyScore}/100) — this deviates from normal error patterns`);
  }
  if (category === 'network') {
    insights.push('Network-related errors often correlate with connectivity issues or Horizon maintenance');
  }
  if (category === 'stellar') {
    insights.push('Stellar SDK errors typically indicate operation-level failures or configuration issues');
  }
  if (category === 'rate_limit') {
    insights.push('Rate limiting can be mitigated by spreading requests across ledgers (every ~5 seconds)');
  }

  if (errorMessage.toLowerCase().includes('sequence')) {
    insights.push('Sequence number issues suggest stale account data — refresh the account state');
  }
  if (errorMessage.toLowerCase().includes('fee')) {
    insights.push('Fee-related issues may require checking the current network base fee');
  }

  return insights;
}

function computeConfidence(
  errorMessage: string,
  category: string,
  frequency: number,
  resolvedRate: number,
  anomalyScore: number,
): number {
  let base = 0.5;

  for (const [pattern, data] of Object.entries(STELLAR_PATTERN_SCORES)) {
    if (errorMessage.toLowerCase().includes(pattern)) {
      base = data.confidence;
      break;
    }
  }

  if (frequency > 3) base = Math.min(base + 0.15, 0.95);
  if (resolvedRate > 0.7) base = Math.min(base + 0.1, 0.95);
  if (anomalyScore < 20) base = Math.min(base + 0.05, 0.95);
  if (anomalyScore > 80) base = Math.max(base - 0.15, 0.3);

  return Math.round(base * 100) / 100;
}

function getSuggestedActions(
  errorMessage: string,
  category: string,
  similarFixes: { solution?: string }[],
): string[] {
  if (similarFixes.length > 0) {
    const common = similarFixes.slice(0, 3).map((f) => f.solution).filter(Boolean) as string[];
    if (common.length >= 2) return common;
  }

  for (const [pattern, data] of Object.entries(STELLAR_PATTERN_SCORES)) {
    if (errorMessage.toLowerCase().includes(pattern)) {
      return data.actions;
    }
  }

  const generic: Record<string, string[]> = {
    network: [
      'Check your internet connection',
      'Verify the Horizon/Soroban RPC endpoint is reachable',
      'The network may be congested — retry with backoff',
    ],
    validation: [
      'Review the input fields for correctness',
      'Check Stellar address format (G... for public keys)',
      'Ensure all required fields are provided',
    ],
    stellar: [
      'Check the Stellar network status dashboard',
      'Verify account exists and has sufficient balance',
      'Review transaction result codes for detailed failure info',
    ],
    authentication: [
      'Connect your wallet using the Wallet Connect panel',
      'Ensure Freighter or Ledger is unlocked',
      'Check that the wallet is on the correct network',
    ],
    permission: [
      'You may not have signing authority for this account',
      'Check account signers and thresholds in the Account panel',
      'Use a multisig transaction if multiple signatures are needed',
    ],
    rate_limit: [
      'Reduce request frequency with exponential backoff',
      'Use the streaming API instead of polling',
      'Consider a dedicated Horizon endpoint or archive node',
    ],
  };

  return generic[category] ?? [
    'Review the error details and consult Stellar documentation',
    'Try the operation again with different parameters',
    'Check the Stellar Developer Docs for guidance',
  ];
}

export async function runBatchAnalysis(
  errors: { error: unknown; context: string }[],
  network: string,
  activeTab: string,
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  for (const { error, context } of errors) {
    const result = await analyzeError(error, context, network, activeTab);
    results.push(result);
  }
  return results;
}

export interface ErrorTrend {
  totalErrors: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  topPatterns: { fingerprint: string; message: string; count: number }[];
  resolvedRate: number;
  timeframe: string;
}

export async function getErrorTrends(category?: string): Promise<ErrorTrend> {
  const db = await import('./FixHistoryStore');
  const fixes = await db.getRecentFixes(100);

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const patternCounts: Record<string, { message: string; count: number }> = {};

  for (const fix of fixes) {
    byCategory[fix.errorCategory] = (byCategory[fix.errorCategory] || 0) + 1;
    const sev = fix.metadata?.severity as string | undefined;
    if (sev) bySeverity[sev] = (bySeverity[sev] || 0) + 1;

    if (!patternCounts[fix.errorFingerprint]) {
      patternCounts[fix.errorFingerprint] = { message: fix.errorMessage, count: 0 };
    }
    patternCounts[fix.errorFingerprint].count += 1;
  }

  const total = fixes.length;
  const resolved = fixes.filter((f) => f.wasHelpful === true).length;

  const topPatterns = Object.entries(patternCounts)
    .map(([fingerprint, data]) => ({ fingerprint, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalErrors: total,
    byCategory: category ? { [category]: byCategory[category] || 0 } : byCategory,
    bySeverity,
    topPatterns,
    resolvedRate: total > 0 ? resolved / total : 0,
    timeframe: 'last 100 fixes',
  };
}
