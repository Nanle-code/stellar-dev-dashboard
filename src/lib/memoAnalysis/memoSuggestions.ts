/**
 * Memo Template Suggestion System
 * Suggests memo formats based on transaction type and history
 */

export interface MemoTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  pattern: RegExp;
  examples: string[];
  frequency: number;
  lastUsed?: string;
}

export interface MemoSuggestion {
  template: MemoTemplate;
  relevanceScore: number;
  reasoning: string;
}

export interface MemoPatterAnalysis {
  commonPatterns: string[];
  frequentWords: Map<string, number>;
  memoLengthAverage: number;
  templateUsageStats: Map<string, number>;
}

const BUILT_IN_TEMPLATES: MemoTemplate[] = [
  {
    id: 'payment-invoice',
    name: 'Payment Invoice',
    category: 'payment',
    template: 'Payment for Invoice INV-{id}',
    pattern: /^Payment for Invoice INV-/,
    examples: ['Payment for Invoice INV-12345', 'Payment for Invoice INV-PO-2024'],
    frequency: 0,
  },
  {
    id: 'transfer-account',
    name: 'Account Transfer',
    category: 'transfer',
    template: 'Transfer to {account} - {reference}',
    pattern: /^Transfer to/,
    examples: ['Transfer to Savings - Monthly', 'Transfer to Client Account - Project Payment'],
    frequency: 0,
  },
  {
    id: 'deposit-fiat',
    name: 'Fiat Deposit',
    category: 'deposit',
    template: 'Deposit from {source} - {date}',
    pattern: /^Deposit from/,
    examples: ['Deposit from Bank - 2024-01-15', 'Deposit from Exchange - Daily'],
    frequency: 0,
  },
  {
    id: 'swap-assets',
    name: 'Asset Swap',
    category: 'swap',
    template: 'Swap {from_asset} to {to_asset}',
    pattern: /^Swap/,
    examples: ['Swap USDC to XLM', 'Swap ETH to USDC - Rebalance'],
    frequency: 0,
  },
  {
    id: 'reward-staking',
    name: 'Staking Reward',
    category: 'reward',
    template: 'Staking reward for {period}',
    pattern: /^Staking reward/,
    examples: ['Staking reward for July 2024', 'Staking reward - Monthly'],
    frequency: 0,
  },
  {
    id: 'fee-transaction',
    name: 'Transaction Fee',
    category: 'fee',
    template: 'Transaction fee - {description}',
    pattern: /^Transaction fee/,
    examples: ['Transaction fee - Gas', 'Transaction fee - Network'],
    frequency: 0,
  },
  {
    id: 'contract-interaction',
    name: 'Contract Interaction',
    category: 'contract',
    template: 'Contract call: {contract_name} - {action}',
    pattern: /^Contract call:/,
    examples: [
      'Contract call: TokenSwap - Swap',
      'Contract call: LiquidityPool - Deposit',
    ],
    frequency: 0,
  },
  {
    id: 'reference-number',
    name: 'Reference Number',
    category: 'reference',
    template: 'Ref: {reference_id}',
    pattern: /^Ref:/,
    examples: ['Ref: PO-2024-001', 'Ref: INV-12345-ABC'],
    frequency: 0,
  },
];

export class MemoSuggestionEngine {
  private templates: Map<string, MemoTemplate> = new Map();
  private memoHistory: string[] = [];
  private patternCache: MemoPatterAnalysis | null = null;

  constructor() {
    BUILT_IN_TEMPLATES.forEach((template) => {
      this.templates.set(template.id, { ...template });
    });
  }

  /**
   * Suggest memo templates based on transaction type
   */
  suggestTemplates(transactionType: string, context?: Record<string, string>): MemoSuggestion[] {
    const suggestions: MemoSuggestion[] = [];

    this.templates.forEach((template) => {
      if (template.category.toLowerCase() === transactionType.toLowerCase()) {
        suggestions.push({
          template,
          relevanceScore: 0.9 + template.frequency * 0.05,
          reasoning: `This template matches ${transactionType} transactions`,
        });
      }
    });

    // Sort by relevance
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return suggestions.slice(0, 5);
  }

  /**
   * Fill template with provided values
   */
  fillTemplate(templateId: string, values: Record<string, string>): string | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    let filled = template.template;
    Object.entries(values).forEach(([key, value]) => {
      filled = filled.replace(`{${key}}`, value);
    });

    return filled;
  }

  /**
   * Analyze memo patterns from history
   */
  analyzeMemoPatterns(memos: string[]): MemoPatterAnalysis {
    if (memos.length === 0) {
      return {
        commonPatterns: [],
        frequentWords: new Map(),
        memoLengthAverage: 0,
        templateUsageStats: new Map(),
      };
    }

    this.memoHistory = memos;

    // Calculate average length
    const memoLengthAverage = memos.reduce((sum, m) => sum + m.length, 0) / memos.length;

    // Extract frequent words
    const frequentWords = new Map<string, number>();
    memos.forEach((memo) => {
      const words = memo.toLowerCase().split(/[\s\-:,]+/).filter((w) => w.length > 3);
      words.forEach((word) => {
        frequentWords.set(word, (frequentWords.get(word) || 0) + 1);
      });
    });

    // Sort by frequency and keep top 20
    const sortedWords = Array.from(frequentWords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    const frequentWordsMap = new Map(sortedWords);

    // Identify matching patterns
    const commonPatterns: string[] = [];
    this.templates.forEach((template) => {
      const matches = memos.filter((m) => template.pattern.test(m)).length;
      if (matches > memos.length * 0.1) {
        commonPatterns.push(template.name);
      }
    });

    // Template usage stats
    const templateUsageStats = new Map<string, number>();
    this.templates.forEach((template) => {
      const count = memos.filter((m) => template.pattern.test(m)).length;
      if (count > 0) {
        templateUsageStats.set(template.name, count);
      }
    });

    this.patternCache = {
      commonPatterns,
      frequentWords: frequentWordsMap,
      memoLengthAverage,
      templateUsageStats,
    };

    return this.patternCache;
  }

  /**
   * Get cached pattern analysis
   */
  getCachedPatterns(): MemoPatterAnalysis | null {
    return this.patternCache;
  }

  /**
   * Record memo usage to improve suggestions
   */
  recordMemoUsage(memo: string, templateId?: string): void {
    this.memoHistory.push(memo);

    if (templateId) {
      const template = this.templates.get(templateId);
      if (template) {
        template.frequency += 1;
        template.lastUsed = new Date().toISOString();
      }
    }

    // Clear pattern cache to recalculate
    this.patternCache = null;
  }

  /**
   * Search memos by pattern
   */
  searchMemos(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return this.memoHistory.filter((memo) => memo.toLowerCase().includes(lowerQuery));
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.templates.forEach((template) => {
      stats[template.name] = template.frequency;
    });
    return stats;
  }

  /**
   * Add custom template
   */
  addCustomTemplate(name: string, category: string, template: string, examples: string[]): MemoTemplate {
    const customTemplate: MemoTemplate = {
      id: `custom-${Date.now()}`,
      name,
      category,
      template,
      pattern: new RegExp(template.replace(/\{[^}]+\}/g, '.*')),
      examples,
      frequency: 0,
    };

    this.templates.set(customTemplate.id, customTemplate);
    return customTemplate;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): MemoTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): MemoTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.category === category);
  }
}

export const memoSuggestionEngine = new MemoSuggestionEngine();
