export interface TradingSignal {
  symbol: string;
  price: number;
  trend: number;
  momentum: number;
  volatility: number;
  volume: number;
  sentiment: number;
}

export interface AgentConfig {
  maxPositionSizePct: number;
  riskPerTradePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  minConfidence: number;
  learningRate: number;
}

export interface StrategyWeights {
  trend: number;
  momentum: number;
  volatility: number;
  volume: number;
  sentiment: number;
}

export interface AgentState {
  capital: number;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  drawdown: number;
  strategyWeights: StrategyWeights;
  recentPerformance: number[];
}

export interface TradePlan {
  action: 'buy' | 'hold' | 'sell';
  confidence: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  rationale: string;
  riskScore: number;
}

export interface LearningEvent {
  symbol: string;
  action: 'buy' | 'sell';
  realizedPnl: number;
  returnPct: number;
}

export function createDefaultAgentConfig(): AgentConfig {
  return {
    maxPositionSizePct: 0.2,
    riskPerTradePct: 0.015,
    stopLossPct: 0.08,
    takeProfitPct: 0.16,
    minConfidence: 0.58,
    learningRate: 0.08,
  };
}

export function createInitialAgentState(capital: number): AgentState {
  return {
    capital,
    totalTrades: 0,
    winningTrades: 0,
    winRate: 0.5,
    drawdown: 0,
    strategyWeights: {
      trend: 0.32,
      momentum: 0.24,
      volatility: 0.16,
      volume: 0.12,
      sentiment: 0.16,
    },
    recentPerformance: [],
  };
}

export function calculatePositionSize(entryPrice: number, stopLossPrice: number, riskBudget: number, capital: number): number {
  const distance = Math.max((entryPrice - stopLossPrice) / entryPrice, 0.01);
  const riskAmount = Math.min(riskBudget, capital * 0.02);
  const raw = (riskAmount / distance) / entryPrice;
  const capped = Math.min(raw, capital * 0.2 / entryPrice);
  return Math.round(capped * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function buildTradePlan(signal: TradingSignal, config: AgentConfig, state: AgentState): TradePlan {
  const weightedScore =
    state.strategyWeights.trend * signal.trend +
    state.strategyWeights.momentum * signal.momentum +
    (1 - signal.volatility) * state.strategyWeights.volatility +
    signal.volume * state.strategyWeights.volume +
    signal.sentiment * state.strategyWeights.sentiment;

  const riskScore = clamp01((signal.volatility * 0.5 + (1 - signal.volume) * 0.3 + (1 - signal.sentiment) * 0.2));
  const confidence = clamp01(weightedScore * 0.7 + (signal.trend + signal.momentum + signal.sentiment) / 3 * 0.3);
  const stopLoss = signal.price * (1 - config.stopLossPct);
  const takeProfit = signal.price * (1 + config.takeProfitPct);

  let action: TradePlan['action'] = 'hold';
  if (confidence >= config.minConfidence && weightedScore > 0.6 && riskScore < 0.65) {
    action = 'buy';
  } else if (confidence < 0.45 || riskScore > 0.75) {
    action = 'sell';
  }

  const positionSize = calculatePositionSize(signal.price, stopLoss, config.riskPerTradePct * state.capital, state.capital);

  return {
    action,
    confidence,
    stopLoss,
    takeProfit,
    positionSize,
    rationale: action === 'buy'
      ? 'Momentum and trend indicators align with a favorable risk-adjusted setup.'
      : 'Risk profile is elevated relative to the current opportunity, so the agent stays defensive.',
    riskScore,
  };
}

export function optimizeStrategyWeights(event: LearningEvent, state: AgentState, config: AgentConfig): AgentState {
  const pnlFactor = clamp01((event.realizedPnl > 0 ? 1 : 0.2) + Math.abs(event.returnPct) * 0.3);
  const performanceDelta = event.realizedPnl > 0 ? 0.04 : -0.03;
  const updatedWeights = {
    trend: clamp01(state.strategyWeights.trend + (event.action === 'buy' ? config.learningRate : -config.learningRate) * pnlFactor),
    momentum: clamp01(state.strategyWeights.momentum + (event.action === 'buy' ? config.learningRate * 0.8 : -config.learningRate * 0.6) * pnlFactor),
    volatility: clamp01(state.strategyWeights.volatility + (event.realizedPnl > 0 ? -config.learningRate * 0.4 : config.learningRate * 0.2)),
    volume: clamp01(state.strategyWeights.volume + (event.realizedPnl > 0 ? config.learningRate * 0.2 : -config.learningRate * 0.1)),
    sentiment: clamp01(state.strategyWeights.sentiment + (event.realizedPnl > 0 ? config.learningRate * 0.3 : -config.learningRate * 0.2)),
  };

  const normalized = normalizeWeights(updatedWeights);
  const totalTrades = state.totalTrades + 1;
  const winningTrades = state.winningTrades + (event.realizedPnl > 0 ? 1 : 0);
  const winRate = winningTrades / totalTrades;
  const recentPerformance = [...state.recentPerformance, event.returnPct].slice(-10);
  const drawdown = Math.max(state.drawdown, Math.max(0, -Math.min(event.returnPct, 0)));

  return {
    ...state,
    totalTrades,
    winningTrades,
    winRate,
    drawdown,
    strategyWeights: normalized,
    recentPerformance,
  };
}

function normalizeWeights(weights: StrategyWeights): StrategyWeights {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return {
    trend: weights.trend / total,
    momentum: weights.momentum / total,
    volatility: weights.volatility / total,
    volume: weights.volume / total,
    sentiment: weights.sentiment / total,
  };
}
