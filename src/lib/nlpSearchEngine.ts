export interface SearchIntent {
  type: 'transaction' | 'account' | 'operation' | 'contract' | 'general';
  entities: {
    addresses?: string[];
    amounts?: number[];
    assets?: string[];
    dateRanges?: Array<{ start?: Date; end?: Date }>;
    operationTypes?: string[];
  };
  query: string;
  confidence: number;
}

const INTENT_PATTERNS = {
  transaction: [
    /transaction(?:s)?\s+(?:for|from|to|involving)\s+([A-Z0-9]{56})/i,
    /tx(?:s)?\s+([A-Z0-9]{56})/i,
    /payment(?:s)?\s+(?:to|from)\s+([A-Z0-9]{56})/i,
    /send(?:ing)?\s+(\d+(?:\.\d+)?)\s*([A-Z]{3,})?/i,
  ],
  account: [
    /account\s+([A-Z0-9]{56})/i,
    /balance(?:s)?\s+(?:for|of)\s+([A-Z0-9]{56})/i,
    /who\s+is\s+([A-Z0-9]{56})/i,
  ],
  operation: [
    /operation(?:s)?\s+(?:type|of\s+type)\s+(\w+)/i,
    /(create|payment|path_payment|manage_offer|set_options|change_trust|allow_trust|account_merge|inflation|manage_data|bump_sequence)/i,
  ],
  contract: [
    /contract(?:s)?\s+([A-Z0-9]{56})/i,
    /smart\s+contract\s+([A-Z0-9]{56})/i,
    /invoke\s+([A-Z0-9]{56})/i,
  ],
};

const STELLAR_ADDRESS_REGEX = /[A-Z0-9]{56}/g;
const AMOUNT_REGEX = /(\d+(?:\.\d+)?)\s*([A-Z]{3,})?/g;
const ASSET_REGEX = /\b([A-Z]{3,})\b/g;
const DATE_KEYWORDS = {
  today: () => new Date(),
  yesterday: () => new Date(Date.now() - 86400000),
  'last week': () => new Date(Date.now() - 7 * 86400000),
  'last month': () => new Date(Date.now() - 30 * 86400000),
};

export function classifyIntent(query: string): SearchIntent {
  const lowerQuery = query.toLowerCase();
  let type: SearchIntent['type'] = 'general';
  let confidence = 0.5;

  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        type = intentType as SearchIntent['type'];
        confidence = 0.9;
        break;
      }
    }
    if (confidence > 0.5) break;
  }

  const entities = extractEntities(query);

  return { type, entities, query, confidence };
}

export function extractEntities(query: string): SearchIntent['entities'] {
  const entities: SearchIntent['entities'] = {};

  const addresses = query.match(STELLAR_ADDRESS_REGEX);
  if (addresses && addresses.length > 0) {
    entities.addresses = [...new Set(addresses)];
  }

  const amounts: number[] = [];
  let amountMatch;
  const amountRegex = new RegExp(AMOUNT_REGEX);
  while ((amountMatch = amountRegex.exec(query)) !== null) {
    amounts.push(parseFloat(amountMatch[1]));
    if (amountMatch[2]) {
      entities.assets = entities.assets || [];
      entities.assets.push(amountMatch[2]);
    }
  }
  if (amounts.length > 0) {
    entities.amounts = amounts;
  }

  const assetMatches = query.match(ASSET_REGEX);
  if (assetMatches) {
    entities.assets = [...new Set([...(entities.assets || []), ...assetMatches])];
  }

  for (const [keyword, dateFunc] of Object.entries(DATE_KEYWORDS)) {
    if (query.toLowerCase().includes(keyword)) {
      entities.dateRanges = entities.dateRanges || [];
      entities.dateRanges.push({ start: dateFunc() });
      break;
    }
  }

  return entities;
}

export function parseNaturalLanguageQuery(query: string): {
  filters: {
    addresses?: string[];
    amounts?: { min?: number; max?: number };
    assets?: string[];
    dateRange?: { start?: Date; end?: Date };
    operationTypes?: string[];
  };
  searchTerms: string[];
  intent: SearchIntent;
} {
  const intent = classifyIntent(query);
  const filters: any = {};

  if (intent.entities.addresses) {
    filters.addresses = intent.entities.addresses;
  }

  if (intent.entities.amounts && intent.entities.amounts.length > 0) {
    filters.amounts = {
      min: Math.min(...intent.entities.amounts),
      max: Math.max(...intent.entities.amounts),
    };
  }

  if (intent.entities.assets) {
    filters.assets = intent.entities.assets;
  }

  if (intent.entities.dateRanges && intent.entities.dateRanges.length > 0) {
    filters.dateRange = intent.entities.dateRanges[0];
  }

  if (intent.entities.operationTypes) {
    filters.operationTypes = intent.entities.operationTypes;
  }

  const searchTerms = query
    .replace(STELLAR_ADDRESS_REGEX, '')
    .replace(AMOUNT_REGEX, '')
    .split(/\s+/)
    .filter(term => term.length > 2 && !['the', 'and', 'for', 'from', 'to'].includes(term.toLowerCase()));

  return { filters, searchTerms, intent };
}

export function generateSearchSuggestions(query: string, history: string[]): string[] {
  const lowerQuery = query.toLowerCase();
  const suggestions: string[] = [];

  const historySuggestions = history
    .filter(h => h.toLowerCase().includes(lowerQuery))
    .slice(0, 3);
  suggestions.push(...historySuggestions);

  if (lowerQuery.includes('payment')) {
    suggestions.push('payments to account', 'payment history', 'payment amounts');
  }

  if (lowerQuery.includes('account')) {
    suggestions.push('account balance', 'account operations', 'account created');
  }

  if (lowerQuery.includes('transaction')) {
    suggestions.push('transactions today', 'transaction hash', 'transaction status');
  }

  return [...new Set(suggestions)].slice(0, 5);
}

export function fuzzyMatch(query: string, text: string, threshold: number = 0.6): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t.includes(q)) return true;

  const distance = levenshteinDistance(q, t);
  const maxLength = Math.max(q.length, t.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= threshold;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
