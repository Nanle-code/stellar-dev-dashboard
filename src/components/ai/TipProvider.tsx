import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getAITips, type TipEntry, type TipContext, type TipFrequency } from '../../lib/aiTipEngine';
import { loadLearnerModel } from '../../lib/learnerModel';
import { getTipFrequency, updateTipFrequency } from '../../lib/aiTipEngine';

interface TipProviderState {
  tips: TipEntry[];
  context: TipContext;
  frequency: TipFrequency;
  updateContext: (ctx: Partial<TipContext>) => void;
  refreshTips: () => void;
}

const TipCtx = createContext<TipProviderState | null>(null);

interface TipProviderProps { children: ReactNode; initialContext?: Partial<TipContext>; }

export function TipProvider({ children, initialContext = {} }: TipProviderProps) {
  const [context, setContext] = useState<TipContext>({
    activeTab: initialContext.activeTab || "overview",
    network: initialContext.network || "testnet",
    connectedAddress: initialContext.connectedAddress || null,
    userActions: initialContext.userActions || [],
    currentRoute: initialContext.currentRoute || "/",
    timeOnPage: initialContext.timeOnPage || 0,
  });
  const [tips, setTips] = useState<TipEntry[]>([]);
  const [frequency, setFrequency] = useState(getTipFrequency());

  const refreshTips = useCallback(() => {
    const model = loadLearnerModel();
    setTips(getAITips(context, model, frequency));
  }, [context, frequency]);

  const updateContext = useCallback((ctx: Partial<TipContext>) => {
    setContext(prev => {
      const updated = { ...prev, ...ctx };
      const model = loadLearnerModel();
      setTips(getAITips(updated, model, frequency));
      return updated;
    });
  }, [frequency]);

  useEffect(() => { refreshTips(); }, []);
  useEffect(() => { const interval = setInterval(refreshTips, 30000); return () => clearInterval(interval); }, [refreshTips]);

  return <TipCtx.Provider value={{ tips, context, frequency, updateContext, refreshTips }}>{children}</TipCtx.Provider>;
}

export function useTipContext(): TipProviderState {
  const ctx = useContext(TipCtx);
  if (!ctx) throw new Error("useTipContext must be used within a TipProvider");
  return ctx;
}

export function useAITips(): TipEntry[] {
  const { tips } = useTipContext();
  return tips;
}
