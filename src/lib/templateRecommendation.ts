/**
 * templateRecommendation.ts — Issue #563
 *
 * Browser-safe recommendation engine that ranks Soroban contract templates
 * against a user's stated requirement. Pure functions only: no TensorFlow,
 * no Node APIs, no network. Deterministic given the same inputs and feedback,
 * which makes the "suggests relevant templates 85% of the time" criterion
 * verifiable in a unit test.
 *
 * Scoring combines four transparent signals:
 *   1. Tag overlap      — requirement tags found in the template's tags
 *   2. Category match   — exact category match
 *   3. Keyword hits     — words from free-text found in name/description/tags
 *   4. Feedback boost   — templates previously chosen for similar requirements
 *
 * Each result carries a numeric score and a short list of human-readable
 * reasons so the UI can explain why a template was suggested.
 */

import type { ContractTemplate } from './templateManager';
import { getAllTemplates } from './templateManager';

/** A user's stated need. All fields optional, but at least one should be set. */
export interface TemplateRequirement {
  /** Preferred contract category, if the user knows it. */
  category?: ContractTemplate['category'];
  /** Free-text description of what the user wants to build. */
  description?: string;
  /** Explicit tags/keywords the user supplied. */
  tags?: string[];
}

/** A scored recommendation for a single template. */
export interface TemplateRecommendation {
  template: ContractTemplate;
  score: number;
  reasons: string[];
}

/**
 * Optional lookup for the feedback boost. Given a requirement signature and a
 * template id, returns how many times that template was previously chosen for
 * a similar requirement. Supplied by the feedback store; omitted in pure tests.
 */
export type FeedbackBoostLookup = (
  signature: string,
  templateId: string,
) => number;

// Relative weights for each signal. Tag overlap dominates, category is a strong
// secondary signal, keyword hits break ties, feedback nudges learned winners up.
const WEIGHT_TAG = 10;
const WEIGHT_CATEGORY = 6;
const WEIGHT_KEYWORD = 2;
const WEIGHT_FEEDBACK = 3;

/** Words too common to carry meaning; excluded from keyword matching. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'with', 'that', 'this',
  'i', 'want', 'need', 'build', 'create', 'make', 'my', 'me', 'contract',
  'template', 'is', 'it', 'on', 'in', 'be', 'can', 'will', 'should',
]);

/** Lowercase, split on non-word characters, drop stop words and short tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Build a stable signature for a requirement, used as the feedback key.
 * Normalizes so "escrow with arbiter" and "Arbiter, Escrow" collapse together.
 */
export function requirementSignature(req: TemplateRequirement): string {
  const parts = new Set<string>();
  if (req.category) parts.add(`cat:${req.category}`);
  (req.tags ?? []).forEach((t) => parts.add(t.toLowerCase().trim()));
  if (req.description) tokenize(req.description).forEach((w) => parts.add(w));
  return Array.from(parts).sort().join('|');
}

/** Collect the searchable keyword surface of a template. */
function templateKeywords(t: ContractTemplate): string[] {
  const tagWords = (t.tags ?? []).map((s) => s.toLowerCase());
  return [
    ...tokenize(t.name),
    ...tokenize(t.description),
    ...tagWords,
  ];
}

/**
 * Score a single template against a requirement. Returns the numeric score and
 * the reasons that contributed, so callers can surface an explanation.
 */
export function scoreTemplate(
  template: ContractTemplate,
  req: TemplateRequirement,
  boost: FeedbackBoostLookup | undefined,
  signature: string,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const templateTags = new Set((template.tags ?? []).map((s) => s.toLowerCase()));

  // 1. Tag overlap — the strongest signal.
  const reqTags = (req.tags ?? []).map((s) => s.toLowerCase().trim());
  let tagMatches = 0;
  for (const tag of reqTags) {
    if (templateTags.has(tag)) tagMatches++;
  }
  if (tagMatches > 0) {
    score += tagMatches * WEIGHT_TAG;
    reasons.push(`Matches ${tagMatches} of your tags`);
  }

  // 2. Category match.
  if (req.category && req.category === template.category) {
    score += WEIGHT_CATEGORY;
    reasons.push(`In the ${template.category} category`);
  }

  // 3. Keyword hits from the free-text description.
  if (req.description) {
    const words = new Set(tokenize(req.description));
    const haystack = new Set(templateKeywords(template));
    let hits = 0;
    for (const w of words) {
      if (haystack.has(w)) hits++;
    }
    if (hits > 0) {
      score += hits * WEIGHT_KEYWORD;
      reasons.push(`Description mentions ${hits} relevant term${hits > 1 ? 's' : ''}`);
    }
  }

  // 4. Feedback boost — learned from prior choices for similar requirements.
  if (boost) {
    const picks = boost(signature, template.id);
    if (picks > 0) {
      score += Math.min(picks, 5) * WEIGHT_FEEDBACK;
      reasons.push('Previously chosen for similar needs');
    }
  }

  return { score, reasons };
}

/**
 * Rank all templates against a requirement, best first. Templates with a score
 * of zero are excluded. Ties are broken by name for determinism.
 *
 * @param req      The user's stated requirement.
 * @param options  Optional feedback lookup and a custom template set (tests).
 */
export function recommendTemplates(
  req: TemplateRequirement,
  options: {
    boost?: FeedbackBoostLookup;
    templates?: ContractTemplate[];
    limit?: number;
  } = {},
): TemplateRecommendation[] {
  const templates = options.templates ?? getAllTemplates();
  const signature = requirementSignature(req);

  const scored: TemplateRecommendation[] = templates
    .map((template) => {
      const { score, reasons } = scoreTemplate(template, req, options.boost, signature);
      return { template, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.template.name.localeCompare(b.template.name);
    });

  return typeof options.limit === 'number' ? scored.slice(0, options.limit) : scored;
}

/** Convenience: the single best template for a requirement, or null if none. */
export function bestTemplate(
  req: TemplateRequirement,
  options: { boost?: FeedbackBoostLookup; templates?: ContractTemplate[] } = {},
): ContractTemplate | null {
  const ranked = recommendTemplates(req, { ...options, limit: 1 });
  return ranked.length > 0 ? ranked[0].template : null;
}