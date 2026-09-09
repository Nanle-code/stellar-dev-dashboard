import { getStoredValue, setStoredValue } from './storage'

export interface FeatureInfo {
  id: string
  label: string
  description: string
  category: string
  icon?: string
  keywords: string[]
  relatedFeatures: string[]
  prerequisiteFeatures?: string[]
}

export interface UserInteraction {
  featureId: string
  timestamp: number
  context: {
    activeTab: string
    timeSinceLastInteraction: number
  }
}

export interface Suggestion {
  featureId: string
  feature: FeatureInfo
  score: number
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

export interface FeedbackEntry {
  suggestionId: string
  featureId: string
  signal: 'used' | 'dismissed' | 'thumbsUp' | 'thumbsDown'
  timestamp: number
}

interface SequenceEntry {
  from: string
  to: string
  count: number
}

interface TransitionMatrix {
  [from: string]: {
    [to: string]: number
  }
}

const FEATURES_KEY = 'pfs:features'
const SEQUENCES_KEY = 'pfs:sequences'
const FEEDBACK_KEY = 'pfs:feedback'
const DISABLED_KEY = 'pfs:disabled'

const MAX_SEQUENCES = 1000
const LEARN_RATE = 0.3
const DECAY_THRESHOLD_DAYS = 30

const BUILT_IN_FEATURES: FeatureInfo[] = [
  { id: 'overview', label: 'Overview', description: 'Dashboard overview with key metrics', category: 'Navigation', keywords: ['home', 'dashboard', 'main'], relatedFeatures: ['account', 'transactions'], prerequisiteFeatures: [] },
  { id: 'account', label: 'Account', description: 'View account details and balances', category: 'Finance', keywords: ['balance', 'wallet', 'address'], relatedFeatures: ['transactions', 'portfolio'], prerequisiteFeatures: [] },
  { id: 'transactions', label: 'Transactions', description: 'Browse and filter transactions', category: 'Finance', keywords: ['tx', 'payments', 'history'], relatedFeatures: ['account', 'analytics'], prerequisiteFeatures: ['account'] },
  { id: 'contracts', label: 'Contracts', description: 'Deploy and manage smart contracts', category: 'Development', keywords: ['smart contract', 'soroban', 'deploy'], relatedFeatures: ['contractInteraction', 'builder'], prerequisiteFeatures: ['account'] },
  { id: 'network', label: 'Network Stats', description: 'View network statistics and health', category: 'Monitoring', keywords: ['stats', 'health', 'status'], relatedFeatures: ['systemHealth', 'performance'], prerequisiteFeatures: [] },
  { id: 'builder', label: 'Transaction Builder', description: 'Build custom transactions', category: 'Development', keywords: ['build', 'construct', 'compose'], relatedFeatures: ['txBuilder', 'signer'], prerequisiteFeatures: ['transactions'] },
  { id: 'faucet', label: 'Faucet', description: 'Request testnet funds', category: 'Tools', keywords: ['testnet', 'funds', 'xlm'], relatedFeatures: ['account'], prerequisiteFeatures: [] },
  { id: 'compare', label: 'Account Comparison', description: 'Compare multiple accounts', category: 'Analysis', keywords: ['compare', 'contrast', 'diff'], relatedFeatures: ['account', 'portfolio'], prerequisiteFeatures: ['account'] },
  { id: 'wallet', label: 'Wallet Connect', description: 'Connect external wallets', category: 'Wallet', keywords: ['connect', 'wallet', 'ledger'], relatedFeatures: ['account', 'signer'], prerequisiteFeatures: [] },
  { id: 'signer', label: 'Transaction Signer', description: 'Sign transactions securely', category: 'Security', keywords: ['sign', 'authorize', 'approve'], relatedFeatures: ['builder', 'wallet'], prerequisiteFeatures: ['builder'] },
  { id: 'portfolio', label: 'Portfolio Value', description: 'Track portfolio performance', category: 'Finance', keywords: ['portfolio', 'holdings', 'value'], relatedFeatures: ['account', 'analytics'], prerequisiteFeatures: ['account'] },
  { id: 'txBuilder', label: 'Transaction Builder', description: 'Advanced transaction composition', category: 'Development', keywords: ['compose', 'construct', 'advanced'], relatedFeatures: ['builder', 'signer'], prerequisiteFeatures: ['transactions'] },
  { id: 'contractInteraction', label: 'Contract Interaction', description: 'Interact with deployed contracts', category: 'Development', keywords: ['call', 'invoke', 'interact'], relatedFeatures: ['contracts', 'contractABI'], prerequisiteFeatures: ['contracts'] },
  { id: 'contractABI', label: 'Contract ABI', description: 'View contract ABI and methods', category: 'Development', keywords: ['abi', 'interface', 'methods'], relatedFeatures: ['contracts', 'contractInteraction'], prerequisiteFeatures: ['contracts'] },
  { id: 'dex', label: 'DEX Explorer', description: 'Explore decentralized exchange', category: 'Finance', keywords: ['dex', 'trade', 'swap'], relatedFeatures: ['liquidityPools', 'pathExplorer'], prerequisiteFeatures: ['account'] },
  { id: 'pathExplorer', label: 'Path Explorer', description: 'Find optimal payment paths', category: 'Tools', keywords: ['path', 'route', 'find'], relatedFeatures: ['dex', 'transactions'], prerequisiteFeatures: ['dex'] },
  { id: 'explorers', label: 'Explorer Embed', description: 'Embedded block explorers', category: 'Tools', keywords: ['explorer', 'block', 'search'], relatedFeatures: ['network'], prerequisiteFeatures: [] },
  { id: 'realtime', label: 'Real-Time Ledger', description: 'Live ledger activity feed', category: 'Monitoring', keywords: ['live', 'stream', 'feed'], relatedFeatures: ['network', 'liveActivity'], prerequisiteFeatures: ['network'] },
  { id: 'charts', label: 'Charts', description: 'Advanced data visualization', category: 'Analysis', keywords: ['chart', 'graph', 'visualize'], relatedFeatures: ['analytics', 'portfolio'], prerequisiteFeatures: [] },
  { id: 'assets', label: 'Asset Discovery', description: 'Discover and explore assets', category: 'Finance', keywords: ['asset', 'token', 'discover'], relatedFeatures: ['dex', 'portfolio'], prerequisiteFeatures: [] },
  { id: 'multisig', label: 'Multisig Manager', description: 'Manage multi-signature accounts', category: 'Security', keywords: ['multisig', 'multi-sig', 'signatures'], relatedFeatures: ['signer', 'account'], prerequisiteFeatures: ['account'] },
  { id: 'analytics', label: 'Analytics', description: 'Advanced analytics and insights', category: 'Analysis', keywords: ['analytics', 'insights', 'metrics'], relatedFeatures: ['transactions', 'portfolio'], prerequisiteFeatures: ['transactions'] },
  { id: 'featureFlags', label: 'Feature Flags', description: 'Manage feature toggles', category: 'Settings', keywords: ['flags', 'toggles', 'experiments'], relatedFeatures: ['settings'], prerequisiteFeatures: [] },
  { id: 'systemHealth', label: 'System Health', description: 'System health monitoring', category: 'Monitoring', keywords: ['health', 'monitor', 'status'], relatedFeatures: ['network', 'performance'], prerequisiteFeatures: ['network'] },
  { id: 'performance', label: 'Performance Monitor', description: 'Performance monitoring dashboard', category: 'Monitoring', keywords: ['performance', 'speed', 'metrics'], relatedFeatures: ['systemHealth', 'analytics'], prerequisiteFeatures: [] },
  { id: 'logAnalyzer', label: 'Log Analyzer', description: 'Analyze system logs', category: 'Tools', keywords: ['logs', 'analyze', 'debug'], relatedFeatures: ['performance', 'systemHealth'], prerequisiteFeatures: [] },
  { id: 'settings', label: 'Settings', description: 'Application settings', category: 'Settings', keywords: ['preferences', 'config', 'options'], relatedFeatures: ['featureFlags'], prerequisiteFeatures: [] },
  { id: 'collaboration', label: 'Collaboration', description: 'Real-time collaboration tools', category: 'Tools', keywords: ['collab', 'share', 'team'], relatedFeatures: ['settings'], prerequisiteFeatures: [] },
  { id: 'audit', label: 'Audit Log', description: 'Security audit log', category: 'Security', keywords: ['audit', 'log', 'history'], relatedFeatures: ['security', 'settings'], prerequisiteFeatures: [] },
  { id: 'anchors', label: 'Anchor Integration', description: 'Anchor service integration', category: 'Finance', keywords: ['anchor', 'fiat', 'bridge'], relatedFeatures: ['account', 'transactions'], prerequisiteFeatures: ['account'] },
  { id: 'search', label: 'Advanced Search', description: 'Advanced search across data', category: 'Tools', keywords: ['search', 'find', 'query'], relatedFeatures: ['transactions', 'account'], prerequisiteFeatures: [] },
  { id: 'cacheStats', label: 'Cache Stats', description: 'Cache performance statistics', category: 'Monitoring', keywords: ['cache', 'performance', 'stats'], relatedFeatures: ['performance', 'systemHealth'], prerequisiteFeatures: [] },
  { id: 'liveActivity', label: 'Live Activity Feed', description: 'Real-time activity stream', category: 'Monitoring', keywords: ['activity', 'live', 'feed'], relatedFeatures: ['realtime', 'network'], prerequisiteFeatures: ['network'] },
  { id: 'claimableBalances', label: 'Claimable Balances', description: 'View and claim balances', category: 'Finance', keywords: ['claim', 'balance', 'pending'], relatedFeatures: ['account', 'transactions'], prerequisiteFeatures: ['account'] },
  { id: 'dataExport', label: 'Data Export', description: 'Export data to various formats', category: 'Tools', keywords: ['export', 'csv', 'json'], relatedFeatures: ['analytics', 'transactions'], prerequisiteFeatures: [] },
  { id: 'governance', label: 'Governance', description: 'Stellar governance participation', category: 'Finance', keywords: ['governance', 'vote', 'proposals'], relatedFeatures: ['account', 'network'], prerequisiteFeatures: ['account'] },
  { id: 'compliance', label: 'Compliance Dashboard', description: 'Regulatory compliance tools', category: 'Security', keywords: ['compliance', 'kyc', 'regulatory'], relatedFeatures: ['audit', 'security'], prerequisiteFeatures: [] },
  { id: 'security', label: 'Security Dashboard', description: 'Security monitoring and alerts', category: 'Security', keywords: ['security', 'alerts', 'threats'], relatedFeatures: ['audit', 'compliance'], prerequisiteFeatures: [] },
  { id: 'capacityPlanning', label: 'Capacity Planning', description: 'Infrastructure capacity prediction', category: 'Monitoring', keywords: ['capacity', 'planning', 'scaling'], relatedFeatures: ['systemHealth', 'performance'], prerequisiteFeatures: ['systemHealth'] },
]

export class PredictiveFeatureSuggestions {
  private features: Map<string, FeatureInfo> = new Map()
  private transitionMatrix: TransitionMatrix = {}
  private interactions: UserInteraction[] = []
  private feedback: FeedbackEntry[] = []
  private disabled: boolean = false
  private initialized: boolean = false

  constructor() {
    this.features = new Map(BUILT_IN_FEATURES.map(f => [f.id, f]))
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    try {
      const [sequences, storedFeedback, storedDisabled] = await Promise.all([
        getStoredValue<{ matrix: TransitionMatrix; interactions: UserInteraction[] }>(SEQUENCES_KEY),
        getStoredValue<FeedbackEntry[]>(FEEDBACK_KEY),
        getStoredValue<boolean>(DISABLED_KEY),
      ])
      if (sequences) {
        this.transitionMatrix = sequences.matrix || {}
        this.interactions = sequences.interactions || []
      }
      if (storedFeedback) this.feedback = storedFeedback
      if (typeof storedDisabled === 'boolean') this.disabled = storedDisabled
    } catch {
    }
  }

  private async persist(): Promise<void> {
    try {
      await setStoredValue(SEQUENCES_KEY, { matrix: this.transitionMatrix, interactions: this.interactions })
      await setStoredValue(FEEDBACK_KEY, this.feedback)
    } catch {
    }
  }

  isDisabled(): boolean {
    return this.disabled
  }

  async setDisabled(val: boolean): Promise<void> {
    this.disabled = val
    try {
      await setStoredValue(DISABLED_KEY, val)
    } catch {
    }
  }

  getFeature(id: string): FeatureInfo | undefined {
    return this.features.get(id)
  }

  getAllFeatures(): FeatureInfo[] {
    return Array.from(this.features.values())
  }

  getUsedFeatureIds(): string[] {
    const used = new Set<string>()
    for (const interaction of this.interactions) {
      used.add(interaction.featureId)
    }
    for (const entry of this.feedback) {
      if (entry.signal === 'used') used.add(entry.featureId)
    }
    return Array.from(used)
  }

  recordInteraction(featureId: string, activeTab: string): void {
    if (!this.features.has(featureId)) return

    const lastInteraction = this.interactions.length > 0
      ? this.interactions[this.interactions.length - 1]
      : null

    const interaction: UserInteraction = {
      featureId,
      timestamp: Date.now(),
      context: {
        activeTab,
        timeSinceLastInteraction: lastInteraction ? Date.now() - lastInteraction.timestamp : 0,
      },
    }

    this.interactions.push(interaction)
    if (this.interactions.length > MAX_SEQUENCES) {
      this.interactions = this.interactions.slice(-MAX_SEQUENCES)
    }

    if (lastInteraction && lastInteraction.featureId !== featureId) {
      const from = lastInteraction.featureId
      const to = featureId
      if (!this.transitionMatrix[from]) this.transitionMatrix[from] = {}
      this.transitionMatrix[from][to] = (this.transitionMatrix[from][to] || 0) + 1
    }

    this.persist()
  }

  recordFeedback(suggestionId: string, featureId: string, signal: FeedbackEntry['signal']): void {
    this.feedback.push({ suggestionId, featureId, signal, timestamp: Date.now() })
    if (this.feedback.length > 500) {
      this.feedback = this.feedback.slice(-500)
    }
    this.persist()
  }

  getSuggestions(currentTab: string, count: number = 3): Suggestion[] {
    if (this.disabled) return []

    const suggestions: Suggestion[] = []
    const usedFeatures = new Set(this.getUsedFeatureIds())
    const recentFeatures = this.getRecentFeatures(5)
    const currentFeature = this.features.get(currentTab)

    const candidates = this.getCandidateFeatures(currentTab, usedFeatures)

    for (const candidate of candidates) {
      const feature = this.features.get(candidate)
      if (!feature) continue
      if (feature.id === currentTab) continue

      const score = this.calculateScore(feature, currentTab, recentFeatures, usedFeatures)
      if (score > 0) {
        suggestions.push({
          featureId: feature.id,
          feature,
          score,
          reason: this.getReason(feature, currentTab, score),
          confidence: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low',
        })
      }
    }

    suggestions.sort((a, b) => b.score - a.score)
    return suggestions.slice(0, count)
  }

  private getRecentFeatures(count: number): string[] {
    const recent: string[] = []
    const seen = new Set<string>()
    for (let i = this.interactions.length - 1; i >= 0 && recent.length < count; i--) {
      const fid = this.interactions[i].featureId
      if (!seen.has(fid)) {
        seen.add(fid)
        recent.push(fid)
      }
    }
    return recent
  }

  private getCandidateFeatures(currentTab: string, usedFeatures: Set<string>): string[] {
    const candidates = new Set<string>()
    const currentFeature = this.features.get(currentTab)

    if (this.transitionMatrix[currentTab]) {
      const transitions = this.transitionMatrix[currentTab]
      const sorted = Object.entries(transitions).sort((a, b) => b[1] - a[1])
      for (const [to] of sorted) {
        if (this.features.has(to)) candidates.add(to)
      }
    }

    if (currentFeature) {
      for (const related of currentFeature.relatedFeatures) {
        if (this.features.has(related)) candidates.add(related)
      }
    }

    const unused = Array.from(this.features.values())
      .filter(f => !usedFeatures.has(f.id) || usedFeatures.size < 3)
      .map(f => f.id)
    for (const id of unused) {
      candidates.add(id)
    }

    return Array.from(candidates)
  }

  private calculateScore(
    feature: FeatureInfo,
    currentTab: string,
    recentFeatures: string[],
    usedFeatures: Set<string>,
  ): number {
    let score = 0

    const transitionProb = this.getTransitionProbability(currentTab, feature.id)
    score += transitionProb * 0.4

    const relatedWeight = this.getRelatedWeight(feature, currentTab)
    score += relatedWeight * 0.2

    const recencyBonus = this.getRecencyBonus(feature.id, recentFeatures)
    score += recencyBonus * 0.15

    const discoveryBonus = this.getDiscoveryBonus(feature.id, usedFeatures)
    score += discoveryBonus * 0.15

    const feedbackBoost = this.getFeedbackBoost(feature.id)
    score += feedbackBoost * 0.1

    return Math.min(1, Math.max(0, score))
  }

  private getTransitionProbability(from: string, to: string): number {
    if (!this.transitionMatrix[from]) return 0
    const transitions = this.transitionMatrix[from]
    const total = Object.values(transitions).reduce((sum, c) => sum + c, 0)
    if (total === 0) return 0
    return (transitions[to] || 0) / total
  }

  private getRelatedWeight(feature: FeatureInfo, currentTab: string): number {
    if (feature.relatedFeatures.includes(currentTab)) return 1
    const currentFeature = this.features.get(currentTab)
    if (currentFeature && currentFeature.relatedFeatures.includes(feature.id)) return 0.8
    if (feature.category === currentFeature?.category) return 0.5
    return 0.2
  }

  private getRecencyBonus(featureId: string, recentFeatures: string[]): number {
    const index = recentFeatures.indexOf(featureId)
    if (index === -1) return 0.3
    return Math.max(0, 1 - index * 0.2)
  }

  private getDiscoveryBonus(featureId: string, usedFeatures: Set<string>): number {
    if (!usedFeatures.has(featureId)) return 1
    return 0.1
  }

  private getFeedbackBoost(featureId: string): number {
    let boost = 0
    const recentFeedback = this.feedback.filter(f => f.featureId === featureId)
    for (const fb of recentFeedback.slice(-20)) {
      if (fb.signal === 'thumbsUp' || fb.signal === 'used') boost += 0.1
      if (fb.signal === 'thumbsDown' || fb.signal === 'dismissed') boost -= 0.15
    }
    return Math.max(-0.5, Math.min(0.5, boost))
  }

  private getReason(feature: FeatureInfo, currentTab: string, score: number): string {
    const currentFeature = this.features.get(currentTab)
    const transitionProb = this.getTransitionProbability(currentTab, feature.id)

    if (transitionProb > 0.3) {
      return `Based on your usage patterns, you often go to ${feature.label} after ${currentFeature?.label || currentTab}`
    }
    if (feature.relatedFeatures.includes(currentTab)) {
      return `${feature.label} is commonly used alongside ${currentFeature?.label || currentTab}`
    }
    if (!this.getUsedFeatureIds().includes(feature.id)) {
      return `Discover ${feature.label} - a feature you haven't explored yet`
    }
    if (feature.category === currentFeature?.category) {
      return `Similar to ${currentFeature?.label || currentTab} in the ${feature.category} category`
    }
    return `Consider trying ${feature.label} - ${feature.description}`
  }

  getStats(): { totalInteractions: number; totalTransitions: number; totalFeedback: number; suggestionAccuracy: number } {
    const totalInteractions = this.interactions.length
    const totalTransitions = Object.values(this.transitionMatrix).reduce(
      (sum, t) => sum + Object.values(t).reduce((s, c) => s + c, 0), 0
    )
    const positiveFeedback = this.feedback.filter(f => f.signal === 'thumbsUp' || f.signal === 'used').length
    const totalFeedback = this.feedback.length
    const suggestionAccuracy = totalFeedback > 0 ? positiveFeedback / totalFeedback : 0

    return { totalInteractions, totalTransitions, totalFeedback, suggestionAccuracy }
  }
}

export const globalPredictiveSuggestions = new PredictiveFeatureSuggestions()
