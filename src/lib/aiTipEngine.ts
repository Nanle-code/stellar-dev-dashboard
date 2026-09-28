import type { LearnerModel } from "./learnerModel";

export interface TipEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  relevance: number;
  type: "info" | "action" | "warning" | "tip";
  target?: string;
  action?: string;
  dismissed: boolean;
  feedbackPositive?: number;
  feedbackNegative?: number;
  impressions: number;
  clicks: number;
}

export interface TipContext {
  activeTab: string;
  network: string;
  connectedAddress?: string;
  userActions?: string[];
  currentRoute?: string;
  timeOnPage?: number;
}

export interface TipFrequencyConfig {
  enabled: boolean;
  frequency: "low" | "medium" | "high";
  minInterval: number;
}

const DEFAULT_FREQUENCY: TipFrequencyConfig = {
  enabled: true,
  frequency: "medium",
  minInterval: 120000,
};

const INTERVAL_MAP: Record<"low" | "medium" | "high", number> = {
  low: 300000,
  medium: 120000,
  high: 60000,
};

const DEFAULT_TIPS: Omit<TipEntry, "dismissed" | "impressions" | "clicks">[] = [
  {
    id: "tip-network-indicator",
    title: "Switch Networks Easily",
    description: "Use the network indicator at the top right to switch between testnet and mainnet.",
    category: "general",
    relevance: 0.9,
    type: "tip",
  },
  {
    id: "tip-connect-wallet",
    title: "Connect Freighter Wallet",
    description: "Connect Freighter to seamlessly sign transactions.",
    category: "wallet",
    relevance: 0.85,
    type: "action",
  },
  {
    id: "tip-fee-stats",
    title: "Monitor Network Fees",
    description: "Check current fee stats in the Overview tab to optimize transaction costs.",
    category: "overview",
    relevance: 0.8,
    type: "info",
  },
  {
    id: "tip-keyboard-shortcuts",
    title: "Keyboard Navigation",
    description: "Press '?' anywhere on the dashboard to view keyboard shortcuts.",
    category: "navigation",
    relevance: 0.75,
    type: "tip",
  },
  {
    id: "tip-faucet-fund",
    title: "Fund Testnet Account",
    description: "Get testnet lumens instantly using the built-in faucet.",
    category: "testnet",
    relevance: 0.7,
    type: "action",
  },
  {
    id: "tip-security-audit",
    title: "Security Headers",
    description: "Verify that security headers and origin controls are active.",
    category: "security",
    relevance: 0.65,
    type: "warning",
  },
];

export function getTipFrequency(): TipFrequencyConfig {
  try {
    const raw = localStorage.getItem("ai_tip_frequency");
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return { ...DEFAULT_FREQUENCY };
}

export function updateTipFrequency(updates: Partial<TipFrequencyConfig>): TipFrequencyConfig {
  const current = getTipFrequency();
  const next: TipFrequencyConfig = { ...current, ...updates };
  if (updates.frequency) {
    next.minInterval = INTERVAL_MAP[updates.frequency] || 120000;
  }
  try {
    localStorage.setItem("ai_tip_frequency", JSON.stringify(next));
  } catch {}
  return next;
}

export function resetTipFrequency(): TipFrequencyConfig {
  const def = { ...DEFAULT_FREQUENCY };
  try {
    localStorage.setItem("ai_tip_frequency", JSON.stringify(def));
  } catch {}
  return def;
}

export function dismissTip(tipId: string): void {
  try {
    const raw = localStorage.getItem("ai_tip_dismissed");
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(tipId)) {
      list.push(tipId);
      localStorage.setItem("ai_tip_dismissed", JSON.stringify(list));
    }
  } catch {}
}

export function recordTipFeedback(tipId: string, positive: boolean): void {
  try {
    const raw = localStorage.getItem("ai_tip_feedback");
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[tipId] = positive ? 1 : -1;
    localStorage.setItem("ai_tip_feedback", JSON.stringify(map));
  } catch {}
}

export function recordTipImpression(tipId: string): void {
  try {
    const raw = localStorage.getItem("ai_tip_impressions");
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[tipId] = (map[tipId] || 0) + 1;
    localStorage.setItem("ai_tip_impressions", JSON.stringify(map));
  } catch {}
}

export function recordTipClick(tipId: string): void {
  try {
    const raw = localStorage.getItem("ai_tip_clicks");
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[tipId] = (map[tipId] || 0) + 1;
    localStorage.setItem("ai_tip_clicks", JSON.stringify(map));
  } catch {}
}

export function getAITips(
  context: TipContext,
  model?: LearnerModel | null,
  frequency?: TipFrequencyConfig
): TipEntry[] {
  const freq = frequency || getTipFrequency();
  if (!freq.enabled) return [];

  let dismissed: string[] = [];
  try {
    const raw = localStorage.getItem("ai_tip_dismissed");
    if (raw) dismissed = JSON.parse(raw);
  } catch {}

  const available = DEFAULT_TIPS.filter((t) => !dismissed.includes(t.id));

  const tips: TipEntry[] = available.map((t) => ({
    ...t,
    dismissed: false,
    impressions: 0,
    clicks: 0,
  }));

  tips.sort((a, b) => b.relevance - a.relevance);
  return tips.slice(0, 5);
}

export function generateTipRecommendation(
  context: TipContext,
  model?: LearnerModel | null
): { tips: TipEntry[]; relevanceScore: number } {
  const tips = getAITips(context, model);
  return {
    tips,
    relevanceScore: tips.length > 0 ? tips[0].relevance : 0,
  };
}