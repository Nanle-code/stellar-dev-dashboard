import { create } from 'zustand'

export interface RouteOptimizationState {
  routes: unknown[]
  rankedRoutes: unknown[]
  selectedRoute: unknown | null
  slippagePredictions: unknown[]
  routeExplanations: unknown[]
  isLoading: boolean
  error: string | null
  optimizationHistory: unknown[]
  performanceMetrics: {
    totalOptimizations: number
    avgImprovement: number
    successRate: number
  }
  settings: {
    autoOptimize: boolean
    showExplanations: boolean
    slippageTolerance: number
    maxHops: number
    prioritizeSpeed: boolean
  }
}

export interface RouteOptimizationActions {
  setRoutes: (routes: unknown[]) => void
  setRankedRoutes: (routes: unknown[]) => void
  setSelectedRoute: (route: unknown | null) => void
  setSlippagePredictions: (predictions: unknown[]) => void
  setRouteExplanations: (explanations: unknown[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addOptimizationHistory: (entry: unknown) => void
  updatePerformanceMetrics: (metrics: Partial<RouteOptimizationState['performanceMetrics']>) => void
  updateSettings: (settings: Partial<RouteOptimizationState['settings']>) => void
  clearOptimization: () => void
}

const initialState: RouteOptimizationState = {
  routes: [],
  rankedRoutes: [],
  selectedRoute: null,
  slippagePredictions: [],
  routeExplanations: [],
  isLoading: false,
  error: null,
  optimizationHistory: [],
  performanceMetrics: {
    totalOptimizations: 0,
    avgImprovement: 0,
    successRate: 0,
  },
  settings: {
    autoOptimize: true,
    showExplanations: true,
    slippageTolerance: 0.01,
    maxHops: 5,
    prioritizeSpeed: false,
  },
}

export const useRouteOptimizationStore = create<RouteOptimizationState & RouteOptimizationActions>((set) => ({
  ...initialState,

  setRoutes: (routes) => set({ routes }),

  setRankedRoutes: (_routes) => set({ rankedRoutes: _routes }),

  setSelectedRoute: (_route) => set({ selectedRoute: _route }),

  setSlippagePredictions: (_predictions) => set({ slippagePredictions: _predictions }),

  setRouteExplanations: (_explanations) => set({ routeExplanations: _explanations }),

  setLoading: (_loading) => set({ isLoading: _loading }),

  setError: (_error) => set({ error: _error }),

  addOptimizationHistory: (_entry) => set((state) => ({
    optimizationHistory: [_entry, ...state.optimizationHistory].slice(0, 100),
  })),

  updatePerformanceMetrics: (_metrics) => set((state) => ({
    performanceMetrics: { ...state.performanceMetrics, ..._metrics },
  })),

  updateSettings: (_settings) => set((state) => ({
    settings: { ...state.settings, ..._settings },
  })),

  clearOptimization: () => set({
    routes: [],
    rankedRoutes: [],
    selectedRoute: null,
    slippagePredictions: [],
    routeExplanations: [],
    error: null,
  }),
}))

export default useRouteOptimizationStore
