import { create } from 'zustand'
import type { GasPrediction } from './gasPredictionModel'
import type { CostThreshold, GasPredictionConfig } from './gasPredictionService'

interface GasPredictionState {
  lastPrediction: GasPrediction | null
  thresholds: CostThreshold[]
  accuracyHistory: Array<{ timestamp: string; accuracy: number }>
  config: GasPredictionConfig
  isUpdating: boolean

  setPrediction: (prediction: GasPrediction) => void
  setThresholds: (thresholds: CostThreshold[]) => void
  addThreshold: (threshold: CostThreshold) => void
  removeThreshold: (id: string) => void
  updateThreshold: (id: string, updates: Partial<CostThreshold>) => void
  setConfig: (config: Partial<GasPredictionConfig>) => void
  setIsUpdating: (updating: boolean) => void
  recordAccuracy: (accuracy: number) => void
}

export const useGasPredictionStore = create<GasPredictionState>((set) => ({
  lastPrediction: null,
  thresholds: [],
  accuracyHistory: [],
  config: {
    enableRealTimeUpdates: true,
    updateIntervalMs: 30000,
    accuracyThreshold: 0.9,
    maxHistorySize: 1000,
  },
  isUpdating: false,

  setPrediction: (prediction) => set({ lastPrediction: prediction }),

  setThresholds: (thresholds) => set({ thresholds }),

  addThreshold: (threshold) => set((state) => ({
    thresholds: [...state.thresholds, threshold],
  })),

  removeThreshold: (id) => set((state) => ({
    thresholds: state.thresholds.filter((t) => t.id !== id),
  })),

  updateThreshold: (id, updates) => set((state) => ({
    thresholds: state.thresholds.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  })),

  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config },
  })),

  setIsUpdating: (updating) => set({ isUpdating: updating }),

  recordAccuracy: (accuracy) => set((state) => ({
    accuracyHistory: [
      ...state.accuracyHistory.slice(-99),
      { timestamp: new Date().toISOString(), accuracy },
    ],
  })),
}))
