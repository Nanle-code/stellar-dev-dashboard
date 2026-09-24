/**
 * AI-Powered Transaction Memo Categorization
 * Analyzes memo text to extract meaning and classify transaction type
 */

export type MemoCategoryType =
  | 'payment'
  | 'invoice'
  | 'reference'
  | 'contract'
  | 'transfer'
  | 'reward'
  | 'fee'
  | 'deposit'
  | 'withdrawal'
  | 'swap'
  | 'governance'
  | 'unknown';

export interface MemoCategoryResult {
  category: MemoCategoryType;
  confidence: number;
  keywords: string[];
  description: string;
}

export interface EntityExtractionResult {
  type: 'id' | 'date' | 'amount' | 'account' | 'reference' | 'name';
  value: string;
  confidence: number;
  position: { start: number; end: number };
}

export interface MemoAnalysisResult {
  originalMemo: string;
  category: MemoCategoryResult;
  entities: EntityExtractionResult[];
  summary: string;
  isMeaningful: boolean;
  length: number;
}

interface CategoryPattern {
  pattern: RegExp;
  category: MemoCategoryType;
  keywords: string[];
  weight: number;
}

const CATEGORY_PATTERNS: CategoryPattern[] = [
  {
    pattern: /\b(payment|paid|pay|invoice|bill|amount due)\b/gi,
    category: 'payment',
    keywords: ['payment', 'paid', 'invoice', 'bill'],
    weight: 0.9,
  },
  {
    pattern: /\b(invoice|inv|inv#|invoice#|ref:)\b/gi,
    category: 'invoice',
    keywords: ['invoice', 'inv', 'billing'],
    weight: 0.85,
  },
  {
    pattern: /\b(ref|reference|ref#|transaction id|txn id)\b/gi,
    category: 'reference',
    keywords: ['reference', 'ref', 'id'],
    weight: 0.8,
  },
  {
    pattern: /\b(contract|smart contract|escrow|agreement)\b/gi,
    category: 'contract',
    keywords: ['contract', 'escrow', 'agreement'],
    weight: 0.85,
  },
  {
    pattern: /\b(transfer|xfer|sent|received)\b/gi,
    category: 'transfer',
    keywords: ['transfer', 'sent', 'received'],
    weight: 0.8,
  },
  {
    pattern: /\b(reward|bonus|incentive|airdrop|yield)\b/gi,
    category: 'reward',
    keywords: ['reward', 'bonus', 'airdrop'],
    weight: 0.85,
  },
  {
    pattern: /\b(fee|fees|commission|gas)\b/gi,
    category: 'fee',
    keywords: ['fee', 'commission', 'gas'],
    weight: 0.9,
  },
  {
    pattern: /\b(deposit|deposited|funding)\b/gi,
    category: 'deposit',
    keywords: ['deposit', 'funding'],
    weight: 0.85,
  },
  {
    pattern: /\b(withdrawal|withdraw|withdrawing|cash out)\b/gi,
    category: 'withdrawal',
    keywords: ['withdrawal', 'withdraw'],
    weight: 0.85,
  },
  {
    pattern: /\b(swap|exchange|trade|convert)\b/gi,
    category: 'swap',
    keywords: ['swap', 'exchange', 'trade'],
    weight: 0.85,
  },
  {
    pattern: /\b(governance|vote|proposal|voting)\b/gi,
    category: 'governance',
    keywords: ['governance', 'vote', 'proposal'],
    weight: 0.9,
  },
];

const ENTITY_PATTERNS = [
  {
    type: 'id' as const,
    pattern: /(?:id|invoice|ref|reference|order|ticket|case)[\s:]*([A-Z0-9]{4,})/gi,
    confidence: 0.9,
  },
  {
    type: 'date' as const,
    pattern: /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/g,
    confidence: 0.95,
  },
  {
    type: 'amount' as const,
    pattern: /(?:\$|€|£|USD|EUR|GBP)?\s*(\d+(?:[.,]\d{2})?)/g,
    confidence: 0.85,
  },
  {
    type: 'account' as const,
    pattern: /(?:account|acc|acct)[\s:]*([A-Z0-9]{4,})/gi,
    confidence: 0.8,
  },
  {
    type: 'reference' as const,
    pattern: /(?:ref|reference|serial|code)[\s:]*([A-Z0-9]{3,})/gi,
    confidence: 0.85,
  },
  {
    type: 'name' as const,
    pattern: /(?:from|to|by|client|customer|vendor)[\s:]*([A-Za-z\s]{3,})/gi,
    confidence: 0.75,
  },
];

export class MemoCategorizer {
  private categoryAccuracy: Map<MemoCategoryType, { correct: number; total: number }> = new Map();
  private memoHistory: Array<{ memo: string; category: MemoCategoryType; userConfirmed: boolean }> = [];

  constructor() {
    // Initialize accuracy tracking
    const categories: MemoCategoryType[] = [
      'payment',
      'invoice',
      'reference',
      'contract',
      'transfer',
      'reward',
      'fee',
      'deposit',
      'withdrawal',
      'swap',
      'governance',
      'unknown',
    ];

    categories.forEach((cat) => {
      this.categoryAccuracy.set(cat, { correct: 0, total: 0 });
    });
  }

  /**
   * Categorize a transaction memo
   */
  categorizeRemo(memo: string): MemoCategoryResult {
    if (!memo || memo.trim().length === 0) {
      return {
        category: 'unknown',
        confidence: 0,
        keywords: [],
        description: 'Empty memo',
      };
    }

    const cleanedMemo = memo.toLowerCase().trim();
    const scores: Map<MemoCategoryType, number> = new Map();

    // Calculate scores for each pattern
    CATEGORY_PATTERNS.forEach((pattern) => {
      const matches = (memo.match(pattern.pattern) || []).length;
      const score = (scores.get(pattern.category) || 0) + matches * pattern.weight;
      scores.set(pattern.category, score);
    });

    // Find best match
    let bestCategory: MemoCategoryType = 'unknown';
    let bestScore = 0;

    scores.forEach((score, category) => {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    });

    // Extract keywords from pattern
    const selectedPattern = CATEGORY_PATTERNS.find((p) => p.category === bestCategory);
    const confidence = Math.min(bestScore / 10, 0.99);

    return {
      category: bestCategory,
      confidence,
      keywords: selectedPattern?.keywords || [],
      description: `Classified as ${bestCategory} with ${(confidence * 100).toFixed(1)}% confidence`,
    };
  }

  /**
   * Extract entities from memo text
   */
  extractEntities(memo: string): EntityExtractionResult[] {
    const entities: EntityExtractionResult[] = [];
    const seenValues = new Set<string>();

    ENTITY_PATTERNS.forEach((entityPattern) => {
      let match;
      const pattern = new RegExp(entityPattern.pattern);

      while ((match = pattern.exec(memo)) !== null) {
        const value = match[1] || match[0];

        if (!seenValues.has(value)) {
          entities.push({
            type: entityPattern.type,
            value: value.trim(),
            confidence: entityPattern.confidence,
            position: { start: match.index, end: match.index + match[0].length },
          });
          seenValues.add(value);
        }
      }
    });

    return entities.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * Analyze complete memo with categorization and entity extraction
   */
  analyzeMemo(memo: string): MemoAnalysisResult {
    const category = this.categorizeRemo(memo);
    const entities = this.extractEntities(memo);

    const isMeaningful = category.confidence > 0.3 && (entities.length > 0 || memo.length > 10);

    const summary = this.generateSummary(memo, category, entities);

    return {
      originalMemo: memo,
      category,
      entities,
      summary,
      isMeaningful,
      length: memo.length,
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(memo: string, category: MemoCategoryResult, entities: EntityExtractionResult[]): string {
    const parts: string[] = [];

    parts.push(`This is a ${category.category} memo`);

    if (entities.length > 0) {
      const idEntities = entities.filter((e) => e.type === 'id').slice(0, 2);
      if (idEntities.length > 0) {
        parts.push(`with ID${idEntities.length > 1 ? 's' : ''} ${idEntities.map((e) => e.value).join(', ')}`);
      }

      const dateEntities = entities.filter((e) => e.type === 'date').slice(0, 1);
      if (dateEntities.length > 0) {
        parts.push(`dated ${dateEntities[0].value}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Record feedback to improve accuracy
   */
  recordFeedback(memo: string, correctCategory: MemoCategoryType): void {
    const result = this.categorizeRemo(memo);
    const accuracy = this.categoryAccuracy.get(result.category) || { correct: 0, total: 0 };

    accuracy.total += 1;
    if (result.category === correctCategory) {
      accuracy.correct += 1;
    }

    this.categoryAccuracy.set(result.category, accuracy);
    this.memoHistory.push({ memo, category: correctCategory, userConfirmed: true });
  }

  /**
   * Get current accuracy metrics
   */
  getAccuracyMetrics(): Record<MemoCategoryType, number> {
    const metrics: Record<MemoCategoryType, number> = {} as any;

    this.categoryAccuracy.forEach((value, key) => {
      metrics[key] = value.total > 0 ? value.correct / value.total : 0;
    });

    return metrics;
  }

  /**
   * Get overall accuracy
   */
  getOverallAccuracy(): number {
    let totalCorrect = 0;
    let totalAttempts = 0;

    this.categoryAccuracy.forEach((value) => {
      totalCorrect += value.correct;
      totalAttempts += value.total;
    });

    return totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
  }

  /**
   * Get memo history for pattern learning
   */
  getMemoHistory(): Array<{ memo: string; category: MemoCategoryType; userConfirmed: boolean }> {
    return this.memoHistory;
  }
}

export const memoCategorizer = new MemoCategorizer();
