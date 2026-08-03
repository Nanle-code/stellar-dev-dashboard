/**
 * Multi-Source Data Pipeline
 * Collects sentiment data from news, social media, and on-chain sources
 */

import {
  RawSentimentInput,
  SentimentSource,
  AnalyzedSentiment,
} from '../types/sentiment';
import { sentimentAnalyzer } from './sentimentAnalyzer';

/**
 * Base interface for source adapters
 */
interface SourceAdapter {
  fetch(assetCodes: string[], options?: any): Promise<RawSentimentInput[]>;
  name: SentimentSource;
  priority: number; // higher = more trusted
}

/**
 * News API Adapter
 * Fetches news articles from NewsAPI or similar service
 */
class NewsAPIAdapter implements SourceAdapter {
  name: SentimentSource = SentimentSource.NEWS;
  priority = 0.85;

  async fetch(assetCodes: string[]): Promise<RawSentimentInput[]> {
    try {
      const results: RawSentimentInput[] = [];
      
      for (const assetCode of assetCodes) {
        // In production, this would call NewsAPI.org or similar
        // For now, we return mock data structured for realistic behavior
        const newsMockData = this.generateMockNews(assetCode);
        results.push(...newsMockData);
      }

      return results;
    } catch (error) {
      console.error('NewsAPI fetch error:', error);
      return [];
    }
  }

  private generateMockNews(assetCode: string): RawSentimentInput[] {
    const now = Date.now();
    const newsSamples = [
      `${assetCode} adoption increases by 15% in institutional sector - Major enterprises integrate support`,
      `${assetCode} faces regulatory scrutiny - SEC considers new framework for digital assets`,
      `${assetCode} price volatility concerns - Analysts warn of potential market corrections`,
      `${assetCode} partnerships expand - New integration announced with leading payment provider`,
      `${assetCode} technology upgrade successful - Network performance improves by 40%`,
      `${assetCode} market sentiment turns bullish - Long-term outlook remains positive`,
    ];

    return newsSamples.map((text, i) => ({
      id: `news-${assetCode}-${i}-${now}`,
      source: SentimentSource.NEWS,
      assetCode,
      text,
      timestamp: now - (i * 3600000), // stagger timestamps
      metadata: {
        url: `https://example.com/news/${i}`,
        isVerified: true,
        engagement: 500 + Math.random() * 5000,
      },
    }));
  }
}

/**
 * Twitter/Social Media Adapter
 * Fetches tweets and social media sentiment
 */
class TwitterAdapter implements SourceAdapter {
  name: SentimentSource = SentimentSource.TWITTER;
  priority = 0.72;

  async fetch(assetCodes: string[]): Promise<RawSentimentInput[]> {
    try {
      const results: RawSentimentInput[] = [];

      for (const assetCode of assetCodes) {
        // In production, would use Twitter API v2
        const tweets = this.generateMockTweets(assetCode);
        results.push(...tweets);
      }

      return results;
    } catch (error) {
      console.error('Twitter fetch error:', error);
      return [];
    }
  }

  private generateMockTweets(assetCode: string): RawSentimentInput[] {
    const now = Date.now();
    const tweets = [
      `$${assetCode} 🚀 the future is here! This blockchain is absolute fire! #bullish #HODL`,
      `Really impressed with $${assetCode} development team. They're pushing innovation forward! 📈`,
      `Bought more $${assetCode}, this project has serious potential. Bullish long term!`,
      `Concerned about $${assetCode} recent market dip. Might be heading lower? #bearish #caution`,
      `$${assetCode} looks strong on charts. Institutional adoption news coming soon! Exciting!`,
      `Not sure about $${assetCode} volatility. Too risky for my portfolio right now.`,
    ];

    return tweets.map((text, i) => ({
      id: `twitter-${assetCode}-${i}-${now}`,
      source: SentimentSource.TWITTER,
      assetCode,
      text,
      timestamp: now - (i * 1800000), // 30min stagger
      metadata: {
        author: `user_${Math.floor(Math.random() * 10000)}`,
        engagement: Math.floor(Math.random() * 50000),
        isVerified: Math.random() > 0.9, // 10% chance verified
        url: `https://twitter.com/user/status/${Math.random()}`,
      },
    }));
  }
}

/**
 * Reddit Adapter
 * Fetches sentiment from Reddit discussions
 */
class RedditAdapter implements SourceAdapter {
  name: SentimentSource = SentimentSource.REDDIT;
  priority = 0.68;

  async fetch(assetCodes: string[]): Promise<RawSentimentInput[]> {
    try {
      const results: RawSentimentInput[] = [];

      for (const assetCode of assetCodes) {
        // In production, would use Reddit API
        const posts = this.generateMockRedditPosts(assetCode);
        results.push(...posts);
      }

      return results;
    } catch (error) {
      console.error('Reddit fetch error:', error);
      return [];
    }
  }

  private generateMockRedditPosts(assetCode: string): RawSentimentInput[] {
    const now = Date.now();
    const discussions = [
      `$${assetCode} analysis: Why this could be the next major breakout. Here's my breakdown...`,
      `Anyone else holding $${assetCode}? Thoughts on recent developments?`,
      `$${assetCode} showing strong fundamentals. Partnership news very positive!`,
      `Should I invest in $${assetCode}? Pros and cons would be appreciated.`,
      `$${assetCode} community is amazing. Best developers in crypto space!`,
      `Concerns about $${assetCode} market manipulation. Need more transparency.`,
    ];

    return discussions.map((text, i) => ({
      id: `reddit-${assetCode}-${i}-${now}`,
      source: SentimentSource.REDDIT,
      assetCode,
      text,
      timestamp: now - (i * 7200000), // 2h stagger
      metadata: {
        author: `redditor_${Math.floor(Math.random() * 50000)}`,
        engagement: Math.floor(Math.random() * 10000), // upvotes
        url: `https://reddit.com/r/cryptocurrency/comments/${Math.random()}`,
      },
    }));
  }
}

/**
 * On-Chain Data Adapter
 * Fetches on-chain sentiment indicators from Stellar
 */
class OnChainAdapter implements SourceAdapter {
  name: SentimentSource = SentimentSource.ONCHAIN;
  priority = 0.95; // Highest priority - factual data

  async fetch(assetCodes: string[]): Promise<RawSentimentInput[]> {
    try {
      const results: RawSentimentInput[] = [];

      for (const assetCode of assetCodes) {
        // In production, would fetch real on-chain data from Horizon
        const onChainData = this.generateMockOnChainData(assetCode);
        results.push(...onChainData);
      }

      return results;
    } catch (error) {
      console.error('On-chain fetch error:', error);
      return [];
    }
  }

  private generateMockOnChainData(assetCode: string): RawSentimentInput[] {
    const now = Date.now();
    const baseVolume = 100000000 + Math.random() * 900000000;
    const baseAddresses = 50000 + Math.floor(Math.random() * 200000);
    
    const onChainTexts = [
      `24h trading volume: ${(baseVolume / 1000000).toFixed(2)}M. Network activity high. Address growth +${Math.floor(Math.random() * 50)}%`,
      `Large transaction detected: ${Math.floor(baseVolume / 100000000)} million ${assetCode}. Whale accumulation signals.`,
      `Exchange outflow detected. ${Math.floor(Math.random() * 50)}M ${assetCode} moved to cold storage. Holding signal.`,
      `Active addresses: ${baseAddresses.toLocaleString()}. Ecosystem expanding. User adoption increasing.`,
      `DEX volume surge: ${(baseVolume / 1000000).toFixed(1)}M in 24h. Strong trading interest shown.`,
      `Smart contract interactions up 30% week-over-week. Developer activity healthy.`,
    ];

    return onChainTexts.map((text, i) => ({
      id: `onchain-${assetCode}-${i}-${now}`,
      source: SentimentSource.ONCHAIN,
      assetCode,
      text,
      timestamp: now - (i * 3600000),
      metadata: {
        isVerified: true, // on-chain data is always verified
        engagement: undefined, // not applicable
      },
    }));
  }
}

/**
 * Discord/Community Adapter
 * Monitors community sentiment
 */
class DiscordAdapter implements SourceAdapter {
  name: SentimentSource = SentimentSource.DISCORD;
  priority = 0.65;

  async fetch(assetCodes: string[]): Promise<RawSentimentInput[]> {
    try {
      const results: RawSentimentInput[] = [];

      for (const assetCode of assetCodes) {
        const messages = this.generateMockDiscordMessages(assetCode);
        results.push(...messages);
      }

      return results;
    } catch (error) {
      console.error('Discord fetch error:', error);
      return [];
    }
  }

  private generateMockDiscordMessages(assetCode: string): RawSentimentInput[] {
    const now = Date.now();
    const messages = [
      `Great update from devs! $${assetCode} roadmap looking solid. Excited for upcoming features!`,
      `Community growing fast! Love the energy here. Let's moon! 🚀`,
      `Development progress on track. Mainnet launch coming soon! #bullish`,
      `Anyone worried about competition? Some projects catching up quickly...`,
      `Devs are responsive to community feedback. Really appreciate the transparency!`,
      `Technical analysis looking good. Support holding at current levels.`,
    ];

    return messages.map((text, i) => ({
      id: `discord-${assetCode}-${i}-${now}`,
      source: SentimentSource.DISCORD,
      assetCode,
      text,
      timestamp: now - (i * 1800000),
      metadata: {
        author: `discord_user_${Math.floor(Math.random() * 10000)}`,
        engagement: Math.floor(Math.random() * 1000), // reactions
      },
    }));
  }
}

/**
 * GitHub Activity Adapter
 * Monitors development activity sentiment
 */
class GitHubAdapter implements SourceAdapter {
  name: SentimentSource = SentimentSource.GITHUB;
  priority = 0.88;

  async fetch(assetCodes: string[]): Promise<RawSentimentInput[]> {
    try {
      const results: RawSentimentInput[] = [];

      for (const assetCode of assetCodes) {
        const activity = this.generateMockGitHubActivity(assetCode);
        results.push(...activity);
      }

      return results;
    } catch (error) {
      console.error('GitHub fetch error:', error);
      return [];
    }
  }

  private generateMockGitHubActivity(assetCode: string): RawSentimentInput[] {
    const now = Date.now();
    const activities = [
      `${assetCode}: Merged 15 pull requests this week. Development velocity strong! 📈`,
      `${assetCode}: Fixed critical security vulnerability. Trust restored! ✅`,
      `${assetCode}: Completed major refactor. Code quality improvements excellent!`,
      `${assetCode}: 5 new contributors joined team. Growing developer interest!`,
      `${assetCode}: Updated documentation. Onboarding new developers easier now.`,
      `${assetCode}: Implemented performance optimization. 40% speed improvement! 🎉`,
    ];

    return activities.map((text, i) => ({
      id: `github-${assetCode}-${i}-${now}`,
      source: SentimentSource.GITHUB,
      assetCode,
      text,
      timestamp: now - (i * 86400000), // 1 day stagger
      metadata: {
        isVerified: true,
        engagement: Math.floor(Math.random() * 500), // stars/watchers change
      },
    }));
  }
}

/**
 * Main Sentiment Data Pipeline
 * Orchestrates multi-source data collection and processing
 */
export class SentimentPipeline {
  private adapters: Map<SentimentSource, SourceAdapter> = new Map();
  private rawDataCache: Map<string, RawSentimentInput[]> = new Map();
  private analyzedCache: Map<string, AnalyzedSentiment[]> = new Map();
  private lastFetchTime: Map<string, number> = new Map();
  private readonly cacheTTL = 300000; // 5 minutes

  constructor() {
    // Register all adapters
    this.adapters.set(SentimentSource.NEWS, new NewsAPIAdapter());
    this.adapters.set(SentimentSource.TWITTER, new TwitterAdapter());
    this.adapters.set(SentimentSource.REDDIT, new RedditAdapter());
    this.adapters.set(SentimentSource.ONCHAIN, new OnChainAdapter());
    this.adapters.set(SentimentSource.DISCORD, new DiscordAdapter());
    this.adapters.set(SentimentSource.GITHUB, new GitHubAdapter());
  }

  /**
   * Fetch sentiment data from all sources
   */
  async fetchAllSources(
    assetCodes: string[],
    sources?: SentimentSource[]
  ): Promise<AnalyzedSentiment[]> {
    const cacheKey = this.getCacheKey(assetCodes, sources);
    
    // Check cache
    const lastFetch = this.lastFetchTime.get(cacheKey) || 0;
    if (Date.now() - lastFetch < this.cacheTTL) {
      const cached = this.analyzedCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const sourcesToFetch = sources || Array.from(this.adapters.keys());
    const allRawData: RawSentimentInput[] = [];

    // Fetch from all sources in parallel
    const fetchPromises = sourcesToFetch.map(source => {
      const adapter = this.adapters.get(source);
      if (!adapter) return Promise.resolve([]);
      return adapter.fetch(assetCodes).catch(err => {
        console.error(`Failed to fetch from ${source}:`, err);
        return [];
      });
    });

    const results = await Promise.all(fetchPromises);
    results.forEach(data => allRawData.push(...data));

    // Deduplicate based on content hash
    const deduped = this.deduplicate(allRawData);

    // Analyze sentiment
    const analyzed = sentimentAnalyzer.batchAnalyze(deduped);

    // Cache results
    this.analyzedCache.set(cacheKey, analyzed);
    this.lastFetchTime.set(cacheKey, Date.now());

    return analyzed;
  }

  /**
   * Fetch from specific source
   */
  async fetchFromSource(
    source: SentimentSource,
    assetCodes: string[]
  ): Promise<AnalyzedSentiment[]> {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      throw new Error(`Unknown source: ${source}`);
    }

    const rawData = await adapter.fetch(assetCodes);
    return sentimentAnalyzer.batchAnalyze(rawData);
  }

  /**
   * Real-time stream - continuously fetch updates
   */
  async *streamSentimentUpdates(
    assetCodes: string[],
    intervalMs: number = 60000
  ): AsyncGenerator<AnalyzedSentiment[]> {
    while (true) {
      try {
        const data = await this.fetchAllSources(assetCodes);
        yield data;
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error('Stream error:', error);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  /**
   * Deduplicate sentiment data
   */
  private deduplicate(data: RawSentimentInput[]): RawSentimentInput[] {
    const seen = new Set<string>();
    const result: RawSentimentInput[] = [];

    for (const item of data) {
      // Create hash from normalized text
      const normalized = item.text.toLowerCase().replace(/\s+/g, ' ').trim();
      const hash = `${item.source}-${item.assetCode}-${normalized.substring(0, 50)}`;
      
      if (!seen.has(hash)) {
        seen.add(hash);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Get raw data for a specific asset
   */
  getRawData(assetCode: string): RawSentimentInput[] {
    const data = this.rawDataCache.get(assetCode) || [];
    return data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.rawDataCache.clear();
    this.analyzedCache.clear();
    this.lastFetchTime.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      rawCacheSize: this.rawDataCache.size,
      analyzedCacheSize: this.analyzedCache.size,
      totalCached: Array.from(this.analyzedCache.values()).reduce((sum, arr) => sum + arr.length, 0),
    };
  }

  private getCacheKey(assetCodes: string[], sources?: SentimentSource[]): string {
    const assetStr = assetCodes.sort().join(',');
    const sourceStr = sources ? sources.sort().join(',') : 'all';
    return `${assetStr}:${sourceStr}`;
  }
}

// Export singleton instance
export const sentimentPipeline = new SentimentPipeline();
