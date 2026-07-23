export interface SemanticDocument {
  id: string;
  text: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface SearchResult {
  document: SemanticDocument;
  score: number;
}

export class SemanticSearchEngine {
  private documents: SemanticDocument[] = [];
  private useSimpleEmbedding: boolean = true;

  async indexDocument(doc: SemanticDocument): Promise<void> {
    const embedding = this.useSimpleEmbedding 
      ? this.simpleEmbedding(doc.text)
      : await this.advancedEmbedding(doc.text);
    
    this.documents.push({ ...doc, embedding });
  }

  async indexDocuments(docs: SemanticDocument[]): Promise<void> {
    for (const doc of docs) {
      await this.indexDocument(doc);
    }
  }

  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    const queryEmbedding = this.useSimpleEmbedding 
      ? this.simpleEmbedding(query)
      : await this.advancedEmbedding(query);

    const results: SearchResult[] = this.documents.map(doc => ({
      document: doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding!),
    }));

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private simpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const vocab = [
      'transaction', 'payment', 'account', 'balance', 'send', 'receive',
      'stellar', 'xlm', 'asset', 'operation', 'contract', 'invoke',
      'create', 'manage', 'offer', 'trust', 'merge', 'data',
    ];

    const embedding = new Array(vocab.length).fill(0);
    
    words.forEach(word => {
      const idx = vocab.indexOf(word);
      if (idx !== -1) {
        embedding[idx] += 1;
      }
    });

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding;
  }

  private async advancedEmbedding(text: string): Promise<number[]> {
    return this.simpleEmbedding(text);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  clearIndex(): void {
    this.documents = [];
  }

  getIndexSize(): number {
    return this.documents.length;
  }
}

export const globalSemanticSearch = new SemanticSearchEngine();
