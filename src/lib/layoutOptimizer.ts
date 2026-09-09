import type { WidgetConfig } from '../components/dashboard/types'

export interface LayoutOptimizationDataContext {
  hasRecentTransactions?: boolean
  hasPortfolioAssets?: boolean
  hasNetworkAlerts?: boolean
  hasAccountEvents?: boolean
  hasBalanceChange?: boolean
}

export interface LayoutOptimizationOptions {
  columns: number
  screenWidth?: number
  userImportance?: Record<string, number>
  dataContext?: LayoutOptimizationDataContext
}

const BASE_IMPORTANCE: Record<string, number> = {
  balance: 10,
  transactions: 9,
  dataInsights: 8,
  portfolio: 8,
  networkStats: 7,
  ledgerStats: 7,
  accountStats: 6,
  assets: 6,
  quickActions: 5,
  priceTicker: 5,
}

const RELATED_WIDGETS: Record<string, string[]> = {
  balance: ['transactions', 'assets', 'accountStats'],
  transactions: ['balance', 'dataInsights', 'quickActions'],
  dataInsights: ['transactions', 'networkStats', 'balance'],
  networkStats: ['ledgerStats', 'accountStats'],
  ledgerStats: ['networkStats', 'accountStats'],
  accountStats: ['networkStats', 'balance'],
  assets: ['balance', 'portfolio'],
  priceTicker: ['portfolio', 'assets'],
  quickActions: ['transactions', 'balance'],
}

const DEFAULT_WIDGET_HEIGHT = 280
const MIN_WIDGET_HEIGHT = 220
const MAX_COLUMNS = 6

function clampSpan(span: number, columns: number): number {
  return Math.min(Math.max(Math.round(span), 1), columns)
}

function getBaseImportance(widget: WidgetConfig): number {
  return BASE_IMPORTANCE[widget.type] ?? 4
}

function getRelationalBoost(widget: WidgetConfig, widgets: WidgetConfig[]): number {
  const related = RELATED_WIDGETS[widget.type] || []
  if (!related.length) return 0
  const present = widgets.filter((other) => related.includes(other.type)).length
  return Math.min(2, present * 0.45)
}

export function scoreWidgetImportance(
  widget: WidgetConfig,
  options: LayoutOptimizationOptions = { columns: 3 }
): number {
  const dataContext = options.dataContext || {}
  let score = getBaseImportance(widget)

  if (widget.type === 'transactions' && dataContext.hasRecentTransactions) {
    score += 1.2
  }

  if (widget.type === 'assets' && dataContext.hasPortfolioAssets) {
    score += 1.1
  }

  if (widget.type === 'networkStats' && dataContext.hasNetworkAlerts) {
    score += 1.2
  }

  if (widget.type === 'balance' && dataContext.hasBalanceChange) {
    score += 1.0
  }

  if (widget.type === 'accountStats' && dataContext.hasAccountEvents) {
    score += 0.8
  }

  if (options.userImportance?.[widget.type] !== undefined) {
    score += options.userImportance[widget.type]
  }

  return Math.round((score + Number.EPSILON) * 10) / 10
}

function computeSpan(widget: WidgetConfig, score: number, columns: number): number {
  if (widget.type === 'transactions') {
    return clampSpan(Math.ceil(columns * 0.5 + score / 3), columns)
  }

  if (widget.type === 'dataInsights' || widget.type === 'portfolio') {
    return clampSpan(Math.max(1, Math.round(columns * 0.4 + score / 4)), columns)
  }

  if (widget.type === 'balance' || widget.type === 'networkStats' || widget.type === 'ledgerStats') {
    return clampSpan(Math.max(1, Math.round(columns * 0.35 + score / 5)), columns)
  }

  return clampSpan(Math.max(1, Math.round(columns * 0.25 + score / 6)), columns)
}

function computeHeight(widget: WidgetConfig, score: number): number {
  const baseHeight = Math.max(widget.height || DEFAULT_WIDGET_HEIGHT, DEFAULT_WIDGET_HEIGHT)
  if (score >= 10) return Math.max(baseHeight, 380)
  if (score >= 8.5) return Math.max(baseHeight, 350)
  if (score >= 7) return Math.max(baseHeight, 320)
  return Math.max(baseHeight, MIN_WIDGET_HEIGHT)
}

export function generateOptimizedLayout(
  widgets: WidgetConfig[],
  options: LayoutOptimizationOptions
): WidgetConfig[] {
  const columns = clampSpan(options.columns || 3, MAX_COLUMNS)
  const scored = widgets.map((widget) => {
    const importance = scoreWidgetImportance(widget, options)
    const relation = getRelationalBoost(widget, widgets)
    return {
      widget,
      score: importance + relation,
    }
  })

  const sorted = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.widget.type.localeCompare(b.widget.type)
  })

  const output: WidgetConfig[] = []
  let remaining = columns

  for (const entry of sorted) {
    const span = clampSpan(computeSpan(entry.widget, entry.score, columns), columns)
    const height = computeHeight(entry.widget, entry.score)
    const widgetConfig: WidgetConfig = {
      ...entry.widget,
      span,
      height,
      order: output.length,
    }

    if (span > remaining) {
      remaining = columns
    }

    output.push(widgetConfig)
    remaining -= span
  }

  return output
}
