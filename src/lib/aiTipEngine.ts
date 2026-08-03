import type { LearnerModel } from './learnerModel';

export interface TipContext {
  activeTab: string;
  network: string;
  connectedAddress: string | null;
  userActions: string[];
  currentRoute: string;
  timeOnPage: number;
}

export type TipFrequencyLevel = 'low' | 'medium' | 'high';

export interface TipFrequency {
  enabled: boolean;
  frequency: TipFrequencyLevel;
  minInterval: number;
  maxTips: number;
}

export interface TipEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  relevance: number;
  type: 'info' | 'action' | 'warning' | 'tip';
  target?: string;
  action?: string;
  dismissed: boolean;
  feedbackPositive?: number;
  feedbackNegative?: number;
  impressions: number;
  clicks: number;
}

const STORAGE_KEYS = {
  dismissed: 'ai_tip_dismissed',
  feedback: 'ai_tip_feedback',
  impressions: 'ai_tip_impressions',
  clicks: 'ai_tip_clicks',
  frequency: 'ai_tip_frequency',
} as const;

const DEFAULT_FREQUENCY: TipFrequency = {
  enabled: true,
  frequency: 'medium',
  minInterval: 180000,
  maxTips: 5,
};

const BUILT_IN_TIPS: Omit<TipEntry, 'dismissed' | 'impressions' | 'clicks' | 'feedbackPositive' | 'feedbackNegative'>[] = [
  {
    id: 'ai-tip-quick-start',
    title: 'Explore the dashboard overview',
    description: 'Start by checking the overview tab to see the latest account activity and curated insights.',
    category: 'onboarding',
    relevance: 0.95,
    type: 'info',
    target: '/overview',
    action: 'Go to overview',
  },
  {
    id: 'ai-tip-security-flags',
    title: 'Review security alerts',
    description: 'Monitor security events regularly to catch suspicious transactions earlier.',
    category: 'security',
    relevance: 0.85,
    type: 'warning',
    target: '/security',
    action: 'Open security dashboard',
  },
  {
    id: 'ai-tip-performance-suggestions',
    title: 'Enable performance insights',
    description: 'Use performance monitoring to track transaction latency and resource usage.',
    category: 'performance',
    relevance: 0.78,
    type: 'tip',
    target: '/performance',
    action: 'View performance metrics',
  },
  {
    id: 'ai-tip-proactive-search',
    title: 'Try advanced search filters',
    description: 'Search with filters to narrow results across transactions and accounts more efficiently.',
    category: 'productivity',
    relevance: 0.72,
    type: 'action',
    target: '/search',
    action: 'Open search',
  },
  {
    id: 'ai-tip-builder-shortcut',
    title: 'Build transactions faster',
    description: 'Use the transaction builder for reusable templates and guided wizard flows.',
    category: 'workflow',
    relevance: 0.65,
    type: 'tip',
    target: '/txBuilder',
    action: 'Open builder',
  },
];

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readStorage<T>(key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return safeParse<T>(window.localStorage.getItem(key), fallback);
}

function writeStorage(key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS], value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export function getTipFrequency(): TipFrequency {
  return readStorage(STORAGE_KEYS.frequency, DEFAULT_FREQUENCY);
}

export function updateTipFrequency(updates: Partial<Omit<TipFrequency, 'minInterval'>>): TipFrequency {
  const current = getTipFrequency();
  const frequency = updates.frequency ?? current.frequency;
  const minInterval = frequency === 'low' ? 300000 : frequency === 'high' ? 120000 : 180000;

  const updated: TipFrequency = {
    enabled: updates.enabled ?? current.enabled,
    frequency,
    minInterval,
    maxTips: updates.maxTips ?? current.maxTips,
  };

  writeStorage(STORAGE_KEYS.frequency, updated);
  return updated;
}

export function resetTipFrequency(): TipFrequency {
  writeStorage(STORAGE_KEYS.frequency, DEFAULT_FREQUENCY);
  return DEFAULT_FREQUENCY;
}

export function getAITips(context: TipContext, model: LearnerModel | null, frequency: TipFrequency): TipEntry[] {
  if (!frequency.enabled) {
    return [];
  }

  const dismissed = readStorage(STORAGE_KEYS.dismissed, [] as string[]);
  const feedback = readStorage(STORAGE_KEYS.feedback, {} as Record<string, number>);

  return BUILT_IN_TIPS.map((tip) => ({
    ...tip,
    dismissed: dismissed.includes(tip.id),
    impressions: 0,
    clicks: 0,
    feedbackPositive: feedback[tip.id] ?? 0,
    feedbackNegative: undefined,
  }))
    .filter((tip) => !tip.dismissed)
    .map((tip) => {
      const boost = tip.target && context.activeTab && tip.target.includes(context.activeTab) ? 0.08 : 0;
      return { ...tip, relevance: Math.min(1, tip.relevance + boost) };
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, frequency.maxTips);
}

export function dismissTip(tipId: string): void {
  const dismissed = readStorage(STORAGE_KEYS.dismissed, [] as string[]);
  if (!dismissed.includes(tipId)) {
    dismissed.push(tipId);
    writeStorage(STORAGE_KEYS.dismissed, dismissed);
  }
}

export function recordTipFeedback(tipId: string, helpful: boolean): void {
  const feedback = readStorage(STORAGE_KEYS.feedback, {} as Record<string, number>);
  feedback[tipId] = (feedback[tipId] ?? 0) + (helpful ? 1 : 0);
  writeStorage(STORAGE_KEYS.feedback, feedback);
}

export function recordTipImpression(tipId: string): void {
  const impressions = readStorage(STORAGE_KEYS.impressions, {} as Record<string, number>);
  impressions[tipId] = (impressions[tipId] ?? 0) + 1;
  writeStorage(STORAGE_KEYS.impressions, impressions);
}

export function recordTipClick(tipId: string): void {
  const clicks = readStorage(STORAGE_KEYS.clicks, {} as Record<string, number>);
  clicks[tipId] = (clicks[tipId] ?? 0) + 1;
  writeStorage(STORAGE_KEYS.clicks, clicks);
}

export function generateTipRecommendation(context: TipContext, model: LearnerModel | null) {
  const tips = getAITips(context, model, getTipFrequency());
  const relevanceScore = tips.reduce((sum, tip) => sum + tip.relevance, 0);
  return {
    tips,
    relevanceScore,
  };
}
