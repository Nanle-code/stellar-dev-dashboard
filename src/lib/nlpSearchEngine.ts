export interface SearchIntent {
  type: 'transaction' | 'account' | 'operation' | 'contract' | 'general';
  entities: {
    addresses?: string[];
    amounts?: number[];
    assets?: string[];
    dateRanges?: Array<{ start?: Date; end?: Date }>;
    operationTypes?: string[];
    keywords?: string[];
  };
  query: string;
  confidence: number;
}

interface ParseResult {
  filters: {
    addresses?: string[];
    amounts?: { min?: number; max?: number };
    assets?: string[];
    dateRange?: { start?: Date; end?: Date };
    operationTypes?: string[];
    keywords?: string[];
  };
  searchTerms: string[];
  intent: SearchIntent;
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

const STELLAR_ADDRESS_REGEX = /\bG[A-Z0-9]{2,55}\b/g;
const AMOUNT_REGEX = /(\d+(?:\.\d+)?)\s*([A-Z]{3,})?/g;
const ASSET_REGEX = /\b([A-Z]{3,})\b/g;
const OPERATION_KEYWORDS = ['payment', 'create account', 'manage offer', 'set options', 'change trust', 'allow trust', 'account merge', 'inflation', 'manage data', 'bump sequence'];
const DATE_KEYWORDS = {
  today: () => new Date(),
  yesterday: () => new Date(Date.now() - 86400000),
  'last week': () => new Date(Date.now() - 7 * 86400000),
  'last month': () => new Date(Date.now() - 30 * 86400000),
};

export function classifyIntent(query: string): SearchIntent {
  let type: SearchIntent['type'] = 'general';
  let confidence = 0.5;

  const lowerQuery = query.toLowerCase();
  const conversationalKeywords = ['show me', 'find', 'list', 'look up', 'search', 'display'];
  const hasConversationalKeyword = conversationalKeywords.some(keyword => lowerQuery.includes(keyword));

  if (/(transaction|transactions|payment|payments|transfer|transfers|send|sent)/i.test(lowerQuery)) {
    type = 'transaction';
    confidence = 0.9;
  } else if (/(operation|operations|create account|manage offer|set options|change trust|allow trust)/i.test(lowerQuery)) {
    type = 'operation';
    confidence = 0.84;
  } else if (/(account|accounts|balance|wallet)/i.test(lowerQuery)) {
    type = 'account';
    confidence = 0.85;
  } else if (/(contract|smart contract|invoke)/i.test(lowerQuery)) {
    type = 'contract';
    confidence = 0.88;
  }

  if (hasConversationalKeyword && type === 'general') {
    confidence = 0.6;
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

  const operationMatches = OPERATION_KEYWORDS.filter((keyword) => query.toLowerCase().includes(keyword));
  if (operationMatches.length > 0) {
    entities.operationTypes = operationMatches;
  }

  const keywordTerms = query
    .replace(STELLAR_ADDRESS_REGEX, '')
    .replace(AMOUNT_REGEX, '')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !['show','me','find','list','look','up','search','display','the','and','for','from','to','all','over','only','those','that','with','last','month','week','today','yesterday'].includes(term.toLowerCase()));
  if (keywordTerms.length > 0) {
    entities.keywords = [...new Set(keywordTerms)];
  }

  return entities;
}

export function parseNaturalLanguageQuery(query: string, context?: SearchIntent): ParseResult {
  const intent = classifyIntent(query);
  const filters: any = {};

  const contextAddresses = context?.entities.addresses;
  if (contextAddresses && contextAddresses.length > 0) {
    filters.addresses = contextAddresses;
  }

  if (intent.entities.addresses && intent.entities.addresses.length > 0) {
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

  if (intent.entities.keywords && intent.entities.keywords.length > 0) {
    filters.keywords = intent.entities.keywords;
  }

  const searchTerms = query
    .replace(STELLAR_ADDRESS_REGEX, '')
    .replace(AMOUNT_REGEX, '')
    .split(/\s+/)
    .filter(term => term.length > 2 && !['the', 'and', 'for', 'from', 'to', 'show', 'me', 'find', 'list', 'look', 'up', 'search', 'display', 'all', 'over', 'only', 'those', 'that', 'with', 'last', 'month', 'week', 'today', 'yesterday'].includes(term.toLowerCase()));

  return { filters, searchTerms, intent };
}

export function buildConversationResponse(query: string, context: SearchIntent | null, results: { total?: number } = {}) {
  const parsed = parseNaturalLanguageQuery(query, context ?? undefined);
  const summary = `I found a ${parsed.intent.type} request${parsed.filters.amounts ? ' with amount filters' : ''}${parsed.filters.dateRange ? ' and a time window' : ''}. I can refine it further for ${parsed.intent.type === 'contract' ? 'contract interactions' : 'matching Stellar data'}.`;
  const suggestions = [
    parsed.intent.type === 'transaction' ? 'Show the matching transactions in a table' : 'Show the matching results in a table',
    parsed.intent.type === 'account' ? 'Summarize the account activity' : 'Suggest related queries',
    'Export these results as JSON',
  ];
  const followUpQuestions = [
    parsed.intent.type === 'transaction' ? 'Filter these to only successful payments' : 'Narrow the results to a specific account',
    parsed.intent.type === 'contract' ? 'Show accounts that interacted with this contract' : 'Show related operations for these results',
  ];

  return {
    parsed,
    summary,
    suggestions: [...new Set(suggestions)].slice(0, 3),
    followUpQuestions,
    resultCount: results.total ?? 0,
  };
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
