/**
 * Real-Time Liquidity Engine & Data Feed Manager
 * Stellar Dev Dashboard
 */

import { fetchOrderBook, fetchTrades, parseAssetString } from './dex';
import { getServer } from './stellar';
import {
  predictLiquidityAndPrice,
  LiquidityPredictionResult,
  MarketSnapshot,
  OrderBookEntry,
  TradeRecord,
  getModelMetrics,
  ModelMetrics,
} from '../ml/liquidityPredictionModel';

export interface DEXPair {
  id: string; // e.g. "XLM:USDC"
  name: string; // e.g. "XLM / USDC"
  base: string; // "native" or "XLM" or "CODE:ISSUER"
  counter: string; // "CODE:ISSUER"
}

export const POPULAR_DEX_PAIRS: DEXPair[] = [
  {
    id: 'XLM:USDC',
    name: 'XLM / USDC',
    base: 'native',
    counter: 'USDC:GA5ZSEJYB37JRC5AVCIA5XYG4DZ62NDCJZASB7YR6RHVC3TGNL4S5QV3',
  },
  {
    id: 'XLM:yXLM',
    name: 'XLM / yXLM',
    base: 'native',
    counter: 'yXLM:GARDARKWSPAPERXNVK2XMEYACYSKJDVF3P5TX2UKVHOA2TTR4224VCOE',
  },
  {
    id: 'BTC:XLM',
    name: 'BTC / XLM',
    base: 'BTC:GDPJ256BMMJ7E3ST244FPMB2I6CYDHNJCF65DIBH6VTLEKZZ6REU5C0O',
    counter: 'native',
  },
  {
    id: 'ETH:XLM',
    name: 'ETH / XLM',
    base: 'ETH:GBDEVU63Y6NTHJQQZIFTC23WOQP7URGAKGDYLINKWTO3JGLTNVSTPFCP',
    counter: 'native',
  },
];

type PredictionListener = (result: LiquidityPredictionResult) => void;

class LiquidityEngine {
  private activePair: DEXPair = POPULAR_DEX_PAIRS[0];
  private listeners: Set<PredictionListener> = new Set();
  private timer: any = null;
  private currentResult: LiquidityPredictionResult | null = null;
  private isStreaming: boolean = false;

  constructor() {
    // Generate initial synthetic/real prediction snapshot
    this.currentResult = this.generateSamplePrediction(this.activePair.id);
  }

  public getActivePair(): DEXPair {
    return this.activePair;
  }

  public setActivePair(pair: DEXPair) {
    this.activePair = pair;
    this.refreshPredictions();
  }

  public subscribe(listener: PredictionListener): () => void {
    this.listeners.add(listener);
    if (this.currentResult) {
      listener(this.currentResult);
    }
    this.startStreaming();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopStreaming();
      }
    };
  }

  public async refreshPredictions(network: string = 'testnet'): Promise<LiquidityPredictionResult> {
    try {
      const baseAsset = parseAssetString(this.activePair.base);
      const counterAsset = parseAssetString(this.activePair.counter);

      const orderbook = await fetchOrderBook(baseAsset, counterAsset, network, 20).catch(() => null);
      const trades = await fetchTrades(baseAsset, counterAsset, network, 30).catch(() => []);

      let snapshot: MarketSnapshot;

      if (orderbook && orderbook.bids && orderbook.bids.length > 0) {
        const bids: OrderBookEntry[] = orderbook.bids.map((b: any) => ({
          price: parseFloat(b.price),
          amount: parseFloat(b.amount),
        }));

        const asks: OrderBookEntry[] = orderbook.asks.map((a: any) => ({
          price: parseFloat(a.price),
          amount: parseFloat(a.amount),
        }));

        const recentTrades: TradeRecord[] = (trades || []).map((t: any) => ({
          price: parseFloat(t.price),
          amount: parseFloat(t.base_amount || t.amount || 10),
          timestamp: new Date(t.ledger_close_time || Date.now()).getTime(),
          isBuy: t.base_is_seller === false,
        }));

        snapshot = {
          pair: this.activePair.id,
          timestamp: Date.now(),
          bids,
          asks,
          recentTrades,
          onChainStats: {
            ledgerCloseTime: 5.1,
            baseFee: 100,
            operationCount: 1420,
            transactionCount: 410,
            reserveA: 1500000,
            reserveB: 375000,
          },
        };
      } else {
        snapshot = this.generateSampleMarketSnapshot(this.activePair.id);
      }

      const result = predictLiquidityAndPrice(snapshot);
      this.currentResult = result;
      this.notifyListeners(result);
      return result;
    } catch (err) {
      console.warn('[LiquidityEngine] Horizon fetch fallback to synthetic model', err);
      const result = this.generateSamplePrediction(this.activePair.id);
      this.currentResult = result;
      this.notifyListeners(result);
      return result;
    }
  }

  public getLatestPrediction(): LiquidityPredictionResult {
    if (!this.currentResult) {
      this.currentResult = this.generateSamplePrediction(this.activePair.id);
    }
    return this.currentResult;
  }

  public getMetrics(): ModelMetrics {
    return getModelMetrics();
  }

  private startStreaming() {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.timer = setInterval(() => {
      this.refreshPredictions();
    }, 8000); // 8 second real-time tick refresh
  }

  private stopStreaming() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isStreaming = false;
  }

  private notifyListeners(result: LiquidityPredictionResult) {
    this.listeners.forEach(fn => fn(result));
  }

  public generateSampleMarketSnapshot(pairId: string): MarketSnapshot {
    const basePrice = pairId.includes('USDC') ? 0.125 : pairId.includes('BTC') ? 0.0000028 : 1.02;
    const now = Date.now();

    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];
    for (let i = 0; i < 15; i++) {
      const priceOffset = (i + 1) * 0.0008 * basePrice;
      bids.push({ price: parseFloat((basePrice - priceOffset).toFixed(5)), amount: Math.floor(25000 + Math.random() * 50000) });
      asks.push({ price: parseFloat((basePrice + priceOffset).toFixed(5)), amount: Math.floor(22000 + Math.random() * 45000) });
    }

    const recentTrades: TradeRecord[] = [];
    for (let i = 0; i < 20; i++) {
      recentTrades.push({
        price: parseFloat((basePrice + (Math.random() - 0.5) * 0.002 * basePrice).toFixed(5)),
        amount: Math.floor(1000 + Math.random() * 15000),
        timestamp: now - i * 45 * 1000,
        isBuy: Math.random() > 0.45,
      });
    }

    return {
      pair: pairId,
      timestamp: now,
      bids,
      asks,
      recentTrades,
      onChainStats: {
        ledgerCloseTime: parseFloat((4.8 + Math.random() * 0.6).toFixed(1)),
        baseFee: 100,
        operationCount: 1850,
        transactionCount: 520,
        reserveA: 2400000,
        reserveB: 300000,
      },
    };
  }

  public generateSamplePrediction(pairId: string): LiquidityPredictionResult {
    const snapshot = this.generateSampleMarketSnapshot(pairId);
    return predictLiquidityAndPrice(snapshot);
  }
}

export const liquidityEngine = new LiquidityEngine();
