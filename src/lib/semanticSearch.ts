/**
 * Enhanced Semantic Search Engine
 *
 * Combines TF-IDF weighted embeddings, BM25-style relevance scoring, Stellar-domain
 * synonym expansion, Levenshtein-based typo correction, and relevance feedback boosting
 * to deliver meaningful semantic search results over Stellar blockchain data.
 *
 * Key capabilities:
 *  - Builds a vocabulary from indexed documents (no external model needed)
 *  - Expands queries with domain synonyms (e.g. "send" → ["payment","transfer"])
 *  - Corrects single-character typos before scoring
 *  - Ranks results with cosine similarity on TF-IDF vectors, further boosted by
 *    BM25-style term saturation and user relevance feedback
 *  - Generates human-readable explanations for every result
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticDocument {
  /** Unique identifier */
  id: string;
  /** Plain-text content used for indexing */
  text: string;
  /** Structured metadata preserved in results */
  metadata?: Record<string, unknown>;
  /** Computed embedding (set by engine; consumers should not set directly) */
  embedding?: number[];
}

export interface SearchResult {
  document: SemanticDocument;
  /** Normalised relevance score in [0, 1] */
  score: number;
  /** Human-readable breakdown of why this result ranked here */
  explanation: string;
  /** Terms from the query that matched this document */
  matchedTerms: string[];
  /** True when the document's score was boosted by relevance feedback */
  feedbackBoosted: boolean;
}

export interface QueryExpansion {
  originalTerms: string[];
  expandedTerms: string[];
  synonymsUsed: Record<string, string[]>;
}

export interface TypoCorrection {
  original: string;
  corrected: string;
  wasCorreected: boolean;
}

export interface SemanticSearchOptions {
  /** Maximum number of results to return (default: 10) */
  topK?: number;
  /** Minimum similarity score to include a result (default: 0.01) */
  minScore?: number;
  /** Whether to apply synonym expansion (default: true) */
  expandQuery?: boolean;
  /** Whether to attempt typo correction (default: true) */
  correctTypos?: boolean;
  /** Whether to use feedback boosts from RelevanceFeedbackStore (default: true) */
  applyFeedback?: boolean;
  /** External relevance boosts keyed by docId */
  feedbackBoosts?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Stellar-domain synonym dictionary
// ---------------------------------------------------------------------------

const STELLAR_SYNONYMS: Record<string, string[]> = {
  // Payments / transfers
  send: ['payment', 'transfer', 'transmit', 'remit', 'pay'],
  payment: ['send', 'transfer', 'remit', 'pay', 'disbursement'],
  transfer: ['payment', 'send', 'move', 'shift'],
  receive: ['incoming', 'received', 'destination', 'credited'],
  // Accounts
  account: ['wallet', 'address', 'publickey', 'user'],
  wallet: ['account', 'address', 'publickey'],
  address: ['account', 'wallet', 'publickey', 'key'],
  balance: ['funds', 'holdings', 'amount', 'total'],
  // Assets
  xlm: ['lumen', 'lumens', 'native', 'stellar'],
  lumen: ['xlm', 'lumens', 'native'],
  native: ['xlm', 'lumen', 'lumens'],
  asset: ['token', 'currency', 'coin', 'trustline'],
  token: ['asset', 'currency', 'coin'],
  trustline: ['trust', 'asset', 'token'],
  // Operations
  transaction: ['tx', 'txn', 'operation', 'op', 'record'],
  tx: ['transaction', 'txn', 'op'],
  operation: ['tx', 'transaction', 'op', 'action'],
  op: ['operation', 'transaction', 'tx'],
  // Specific operations
  create: ['createaccount', 'new', 'open', 'genesis'],
  merge: ['accountmerge', 'close', 'combine'],
  offer: ['order', 'trade', 'dex', 'sell', 'buy'],
  trade: ['offer', 'swap', 'exchange', 'dex'],
  swap: ['trade', 'exchange', 'offer'],
  liquidity: ['pool', 'amm', 'lp', 'liquiditypool'],
  // Contracts
  contract: ['soroban', 'smart', 'wasm', 'program'],
  soroban: ['contract', 'smart', 'wasm'],
  invoke: ['call', 'execute', 'run', 'deploy'],
  // Status
  success: ['successful', 'completed', 'confirmed', 'ok'],
  failed: ['failure', 'error', 'rejected', 'unsuccessful'],
  pending: ['unconfirmed', 'waiting', 'queued'],
  // Time
  recent: ['latest', 'new', 'last', 'newest'],
  old: ['oldest', 'historic', 'early', 'first'],
  today: ['now', 'current', 'daily'],
  // Network
  mainnet: ['main', 'production', 'live'],
  testnet: ['test', 'sandbox', 'dev'],
};

// Pre-build reverse map: for any synonym value, map back to the canonical key
const SYNONYM_REVERSE: Record<string, string[]> = {};
for (const [canonical, synonyms] of Object.entries(STELLAR_SYNONYMS)) {
  for (const syn of synonyms) {
    if (!SYNONYM_REVERSE[syn]) SYNONYM_REVERSE[syn] = [];
    if (!SYNONYM_REVERSE[syn].includes(canonical)) SYNONYM_REVERSE[syn].push(canonical);
  }
}

// ---------------------------------------------------------------------------
// BM25 hyper-parameters
// ---------------------------------------------------------------------------
const BM25_K1 = 1.5; // term-frequency saturation
const BM25_B = 0.75; // document-length normalisation

// ---------------------------------------------------------------------------
// Helper: Levenshtein distance
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
      }
    }
  }
  return dp[m][n];
}

// ---------------------------------------------------------------------------
// Helper: tokenise text
// ---------------------------------------------------------------------------
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// Stop-words to strip before indexing
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'in', 'it', 'of', 'or', 'at', 'by', 'be', 'as',
  'to', 'for', 'on', 'do', 'if', 'no', 'so', 'up', 'we', 'me', 'my',
]);

function filterStopWords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP_WORDS.has(t));
}

// ---------------------------------------------------------------------------
// SemanticSearchEngine
// ---------------------------------------------------------------------------

export class SemanticSearchEngine {
  // Indexed documents
  private docs: SemanticDocument[] = [];
  // term → [docIdx, …]  (inverted index)
  private invertedIndex: Map<string, number[]> = new Map();
  // term → IDF value
  private idf: Map<string, number> = new Map();
  // term → global document frequency
  private df: Map<string, number> = new Map();
  // Vocabulary array (position = dimension in embedding vector)
  private vocab: string[] = [];
  private vocabIndex: Map<string, number> = new Map();
  // Average document length (tokens)
  private avgDocLen = 0;

  // ---------------------------------------------------------------------------
  // Index management
  // ---------------------------------------------------------------------------

  /** Add a single document to the index. */
  indexDocument(doc: SemanticDocument): void {
    const tokens = filterStopWords(tokenise(doc.text));
    const docIdx = this.docs.length;

    // TF for this document
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    // Update vocab & inverted index
    for (const term of tf.keys()) {
      if (!this.vocabIndex.has(term)) {
        this.vocabIndex.set(term, this.vocab.length);
        this.vocab.push(term);
      }
      if (!this.invertedIndex.has(term)) this.invertedIndex.set(term, []);
      this.invertedIndex.get(term)!.push(docIdx);
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }

    // Store document with its token list length
    const stored: SemanticDocument & { _tokens?: string[]; _tf?: Map<string, number> } = {
      ...doc,
      _tokens: tokens,
      _tf: tf,
    };
    this.docs.push(stored);

    // Recompute IDF and average doc length (incremental approximation)
    this._recomputeIdf();
    this._recomputeAvgDocLen();
  }

  /** Index many documents at once. More efficient than repeated single calls. */
  indexDocuments(docs: SemanticDocument[]): void {
    for (const doc of docs) {
      // Defer IDF recompute until the end
      const tokens = filterStopWords(tokenise(doc.text));
      const docIdx = this.docs.length;
      const tf = new Map<string, number>();
      for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
      for (const term of tf.keys()) {
        if (!this.vocabIndex.has(term)) {
          this.vocabIndex.set(term, this.vocab.length);
          this.vocab.push(term);
        }
        if (!this.invertedIndex.has(term)) this.invertedIndex.set(term, []);
        this.invertedIndex.get(term)!.push(docIdx);
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
      const stored = { ...doc, _tokens: tokens, _tf: tf } as SemanticDocument & {
        _tokens: string[];
        _tf: Map<string, number>;
      };
      this.docs.push(stored as SemanticDocument);
    }
    this._recomputeIdf();
    this._recomputeAvgDocLen();
  }

  private _recomputeIdf(): void {
    const N = this.docs.length;
    if (N === 0) return;
    for (const [term, df] of this.df.entries()) {
      // Smoothed IDF (BM25 variant)
      this.idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
    }
  }

  private _recomputeAvgDocLen(): void {
    if (this.docs.length === 0) { this.avgDocLen = 0; return; }
    const total = (this.docs as Array<SemanticDocument & { _tokens?: string[] }>)
      .reduce((sum, d) => sum + (d._tokens?.length ?? 0), 0);
    this.avgDocLen = total / this.docs.length;
  }

  clearIndex(): void {
    this.docs = [];
    this.invertedIndex.clear();
    this.idf.clear();
    this.df.clear();
    this.vocab = [];
    this.vocabIndex.clear();
    this.avgDocLen = 0;
  }

  getIndexSize(): number { return this.docs.length; }

  // ---------------------------------------------------------------------------
  // Query expansion
  // ---------------------------------------------------------------------------

  expandQuery(query: string): QueryExpansion {
    const originalTerms = filterStopWords(tokenise(query));
    const synonymsUsed: Record<string, string[]> = {};
    const expanded = new Set<string>(originalTerms);

    for (const term of originalTerms) {
      // Direct synonyms from canonical → synonyms
      const direct = STELLAR_SYNONYMS[term];
      if (direct?.length) {
        for (const syn of direct) expanded.add(syn);
        synonymsUsed[term] = direct;
      }
      // Reverse: term is a synonym of some canonical
      const reverse = SYNONYM_REVERSE[term];
      if (reverse?.length) {
        for (const canonical of reverse) {
          expanded.add(canonical);
          const canSyns = STELLAR_SYNONYMS[canonical] ?? [];
          for (const syn of canSyns) expanded.add(syn);
          synonymsUsed[term] = [...(synonymsUsed[term] ?? []), canonical, ...canSyns];
        }
      }
    }

    return {
      originalTerms,
      expandedTerms: Array.from(expanded),
      synonymsUsed,
    };
  }

  // ---------------------------------------------------------------------------
  // Typo correction
  // ---------------------------------------------------------------------------

  correctTypo(word: string): TypoCorrection {
    if (this.vocab.length === 0 || word.length < 4) {
      return { original: word, corrected: word, wasCorreected: false };
    }
    // Only correct if the word is NOT already in vocab
    if (this.vocabIndex.has(word)) {
      return { original: word, corrected: word, wasCorreected: false };
    }

    let best = word;
    let bestDist = Infinity;
    for (const vocabTerm of this.vocab) {
      // Cheap length-difference guard before running full levenshtein
      if (Math.abs(vocabTerm.length - word.length) > 2) continue;
      const d = levenshtein(word, vocabTerm);
      if (d < bestDist) {
        bestDist = d;
        best = vocabTerm;
      }
    }
    // Accept correction only if edit distance ≤ 2
    if (bestDist <= 2 && best !== word) {
      return { original: word, corrected: best, wasCorreected: true };
    }
    return { original: word, corrected: word, wasCorreected: false };
  }

  correctQueryTerms(terms: string[]): { corrected: string[]; corrections: TypoCorrection[] } {
    const corrections: TypoCorrection[] = [];
    const corrected = terms.map((t) => {
      const c = this.correctTypo(t);
      corrections.push(c);
      return c.corrected;
    });
    return { corrected, corrections };
  }

  // ---------------------------------------------------------------------------
  // TF-IDF embedding
  // ---------------------------------------------------------------------------

  /**
   * Build a TF-IDF vector for a list of terms against the current vocabulary.
   * The vector length equals the vocab size.
   */
  private buildVector(terms: string[], docLen: number): number[] {
    const vec = new Array(this.vocab.length).fill(0);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);

    for (const [term, rawTf] of tf.entries()) {
      const idx = this.vocabIndex.get(term);
      if (idx === undefined) continue;
      const idfVal = this.idf.get(term) ?? 0;
      // BM25-style TF normalisation
      const normTf =
        (rawTf * (BM25_K1 + 1)) /
        (rawTf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / (this.avgDocLen || 1))));
      vec[idx] = normTf * idfVal;
    }
    return vec;
  }

  private dotProduct(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  private magnitude(v: number[]): number {
    return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const magA = this.magnitude(a);
    const magB = this.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return this.dotProduct(a, b) / (magA * magB);
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  search(query: string, options: SemanticSearchOptions = {}): SearchResult[] {
    const {
      topK = 10,
      minScore = 0.01,
      expandQuery = true,
      correctTypos = true,
      feedbackBoosts = {},
    } = options;

    if (this.docs.length === 0) return [];

    // Step 1 – Tokenise query
    let queryTerms = filterStopWords(tokenise(query));

    // Step 2 – Typo correction
    const typoResults: TypoCorrection[] = [];
    if (correctTypos) {
      const { corrected, corrections } = this.correctQueryTerms(queryTerms);
      queryTerms = corrected;
      typoResults.push(...corrections);
    }

    // Step 3 – Synonym expansion
    let allQueryTerms = queryTerms;
    let expansion: QueryExpansion | null = null;
    if (expandQuery) {
      expansion = this.expandQuery(queryTerms.join(' '));
      allQueryTerms = expansion.expandedTerms;
    }

    if (allQueryTerms.length === 0) return [];

    // Step 4 – Build query vector
    const queryVec = this.buildVector(allQueryTerms, allQueryTerms.length);
    const queryMag = this.magnitude(queryVec);

    // Step 5 – Score documents using cosine similarity
    const results: SearchResult[] = [];

    for (let docIdx = 0; docIdx < this.docs.length; docIdx++) {
      const doc = this.docs[docIdx] as SemanticDocument & {
        _tokens?: string[];
        _tf?: Map<string, number>;
      };
      const docTokens = doc._tokens ?? filterStopWords(tokenise(doc.text));
      const docVec = this.buildVector(docTokens, docTokens.length);

      let score = this.cosineSimilarity(queryVec, docVec);
      if (queryMag === 0) score = 0;

      // Step 6 – Apply relevance feedback boost
      const feedbackBoost = feedbackBoosts[doc.id] ?? 0;
      let feedbackBoosted = false;
      if (feedbackBoost !== 0) {
        score = Math.min(1, score + feedbackBoost);
        feedbackBoosted = feedbackBoost > 0;
      }

      if (score < minScore) continue;

      // Step 7 – Find matched terms for explanation
      const matchedTerms = allQueryTerms.filter((t) => docTokens.includes(t));

      // Step 8 – Generate explanation
      const explanation = this._buildExplanation(
        score,
        matchedTerms,
        queryTerms,
        expansion,
        typoResults.filter((c) => c.wasCorreected),
        feedbackBoosted,
        feedbackBoost
      );

      results.push({
        document: { id: doc.id, text: doc.text, metadata: doc.metadata },
        score,
        explanation,
        matchedTerms,
        feedbackBoosted,
      });
    }

    // Step 9 – Sort by score descending, take topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // ---------------------------------------------------------------------------
  // Explanation generation
  // ---------------------------------------------------------------------------

  private _buildExplanation(
    score: number,
    matchedTerms: string[],
    originalTerms: string[],
    expansion: QueryExpansion | null,
    corrections: TypoCorrection[],
    feedbackBoosted: boolean,
    feedbackBoost: number
  ): string {
    const parts: string[] = [];

    // Relevance score
    const pct = Math.round(score * 100);
    if (pct >= 80) parts.push(`Very high relevance (${pct}%)`);
    else if (pct >= 50) parts.push(`Good relevance (${pct}%)`);
    else if (pct >= 20) parts.push(`Moderate relevance (${pct}%)`);
    else parts.push(`Low relevance (${pct}%)`);

    // Matched terms
    if (matchedTerms.length > 0) {
      parts.push(`Matched: ${matchedTerms.slice(0, 5).join(', ')}`);
    } else {
      parts.push('No direct term matches');
    }

    // Synonym expansion
    if (expansion) {
      const synsUsed = Object.entries(expansion.synonymsUsed)
        .filter(([k]) => originalTerms.includes(k))
        .map(([k, v]) => `${k} → ${v.slice(0, 2).join('/')}`)
        .slice(0, 2);
      if (synsUsed.length > 0) parts.push(`Synonyms expanded: ${synsUsed.join('; ')}`);
    }

    // Typo corrections
    if (corrections.length > 0) {
      const corrStr = corrections
        .map((c) => `"${c.original}" → "${c.corrected}"`)
        .join(', ');
      parts.push(`Typo corrected: ${corrStr}`);
    }

    // Feedback boost
    if (feedbackBoosted) {
      parts.push(`Boosted by your feedback (+${Math.round(feedbackBoost * 100)}%)`);
    } else if (feedbackBoost < 0) {
      parts.push(`Demoted by your feedback (${Math.round(feedbackBoost * 100)}%)`);
    }

    return parts.join(' • ');
  }

  // ---------------------------------------------------------------------------
  // Utility / compat
  // ---------------------------------------------------------------------------

  /**
   * Compare two query vectors (legacy cosine utility, kept for compat).
   */
  compareQueries(queryA: string, queryB: string): number {
    const tokA = filterStopWords(tokenise(queryA));
    const tokB = filterStopWords(tokenise(queryB));
    const vecA = this.buildVector(tokA, tokA.length);
    const vecB = this.buildVector(tokB, tokB.length);
    return this.cosineSimilarity(vecA, vecB);
  }

  /**
   * Return a set of query suggestions based on partial input and the current vocab.
   */
  getSuggestions(partial: string, maxSuggestions = 8): string[] {
    const lower = partial.toLowerCase().trim();
    if (lower.length < 2) return [];

    const suggestions = new Set<string>();

    // Vocab completions
    for (const term of this.vocab) {
      if (term.startsWith(lower) && term !== lower) suggestions.add(term);
      if (suggestions.size >= maxSuggestions) break;
    }

    // Synonym suggestions
    for (const [canonical, syns] of Object.entries(STELLAR_SYNONYMS)) {
      if (canonical.startsWith(lower)) suggestions.add(canonical);
      for (const syn of syns) {
        if (syn.startsWith(lower)) suggestions.add(syn);
      }
    }

    return Array.from(suggestions).slice(0, maxSuggestions);
  }
}

// ---------------------------------------------------------------------------
// Singleton for app-wide use
// ---------------------------------------------------------------------------
export const globalSemanticSearch = new SemanticSearchEngine();
