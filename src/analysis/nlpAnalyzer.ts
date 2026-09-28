export interface TextSentimentResult {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number; // Range -1.0 to 1.0
  intent: 'PAYMENT' | 'TRADE' | 'STAKING' | 'GOVERNANCE' | 'UNKNOWN';
  detectedKeywords: string[];
}

export class StellarNLPAnalyzer {
  private positiveKeywords = ['buy', 'pump', 'growth', 'reward', 'stake', 'airdrop', 'dividend'];
  private negativeKeywords = ['dump', 'sell', 'scam', 'loss', 'hack', 'drain', 'liquidate'];

  private intentMap: Record<string, 'PAYMENT' | 'TRADE' | 'STAKING' | 'GOVERNANCE'> = {
    pay: 'PAYMENT',
    invoice: 'PAYMENT',
    trade: 'TRADE',
    swap: 'TRADE',
    stake: 'STAKING',
    yield: 'STAKING',
    vote: 'GOVERNANCE',
    proposal: 'GOVERNANCE',
  };

  public analyzeText(text: string): TextSentimentResult {
    const tokens = text.toLowerCase().match(/\w+/g) || [];
    let positiveCount = 0;
    let negativeCount = 0;
    const detectedKeywords: string[] = [];

    let intent: 'PAYMENT' | 'TRADE' | 'STAKING' | 'GOVERNANCE' | 'UNKNOWN' = 'UNKNOWN';

    for (const token of tokens) {
      if (this.positiveKeywords.includes(token)) {
        positiveCount++;
        detectedKeywords.push(token);
      }
      if (this.negativeKeywords.includes(token)) {
        negativeCount++;
        detectedKeywords.push(token);
      }
      if (this.intentMap[token] && intent === 'UNKNOWN') {
        intent = this.intentMap[token];
      }
    }

    const totalMatches = positiveCount + negativeCount;
    let score = 0;
    let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';

    if (totalMatches > 0) {
      score = parseFloat(((positiveCount - negativeCount) / totalMatches).toFixed(2));
      if (score > 0.2) sentiment = 'POSITIVE';
      else if (score < -0.2) sentiment = 'NEGATIVE';
    }

    return {
      sentiment,
      score,
      intent,
      detectedKeywords,
    };
  }
}