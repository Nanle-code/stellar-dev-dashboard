export interface EntityInfo {
  address: string;
  name: string;
  category: 'EXCHANGE' | 'MARKET_MAKER' | 'LIQUIDITY_POOL' | 'WHALE' | 'UNKNOWN';
  confidenceScore: number;
}

export interface NetworkGraphEdge {
  source: string;
  target: string;
  volumeXLM: number;
  transactionCount: number;
}

export interface NetworkGraphData {
  entities: EntityInfo[];
  edges: NetworkGraphEdge[];
  densityScore: number;
}

export class StellarGraphEngine {
  private knownEntities: Map<string, EntityInfo> = new Map([
    [
      'G1234567890BINANCE',
      { address: 'G1234567890BINANCE', name: 'Binance Hot Wallet', category: 'EXCHANGE', confidenceScore: 0.99 },
    ],
    [
      'G9876543210KRAKEN',
      { address: 'G9876543210KRAKEN', name: 'Kraken Cold Storage', category: 'EXCHANGE', confidenceScore: 0.98 },
    ],
  ]);

  public resolveEntity(address: string): EntityInfo {
    if (this.knownEntities.has(address)) {
      return this.knownEntities.get(address)!;
    }
    return {
      address,
      name: `Entity-${address.substring(0, 6)}...`,
      category: 'UNKNOWN',
      confidenceScore: 0.5,
    };
  }

  public buildFlowGraph(transactions: { source: string; target: string; amount: number }[]): NetworkGraphData {
    const entityMap = new Map<string, EntityInfo>();
    const edgeMap = new Map<string, NetworkGraphEdge>();

    for (const tx of transactions) {
      const sourceEntity = this.resolveEntity(tx.source);
      const targetEntity = this.resolveEntity(tx.target);

      entityMap.set(sourceEntity.address, sourceEntity);
      entityMap.set(targetEntity.address, targetEntity);

      const edgeKey = `${tx.source}->${tx.target}`;
      const existingEdge = edgeMap.get(edgeKey);

      if (existingEdge) {
        existingEdge.volumeXLM += tx.amount;
        existingEdge.transactionCount += 1;
      } else {
        edgeMap.set(edgeKey, {
          source: tx.source,
          target: tx.target,
          volumeXLM: tx.amount,
          transactionCount: 1,
        });
      }
    }

    const entities = Array.from(entityMap.values());
    const edges = Array.from(edgeMap.values());
    const possibleEdges = Math.max(1, entities.length * (entities.length - 1));
    const densityScore = parseFloat((edges.length / possibleEdges).toFixed(4));

    return { entities, edges, densityScore };
  }
}