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