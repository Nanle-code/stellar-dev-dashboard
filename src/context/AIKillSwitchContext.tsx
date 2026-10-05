import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AIKillSwitchContextValue {
  enabled: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
}

const AIKillSwitchContext = createContext<AIKillSwitchContextValue>({
  enabled: false,
  ready: false,
  refresh: async () => {},
});

export function AIKillSwitchProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/ai-controls', { cache: 'no-store' });
      if (!response.ok) throw new Error(`AI control status returned ${response.status}`);
      const payload = await response.json();
      if (typeof payload?.data?.enabled !== 'boolean') throw new Error('Invalid AI control status');
      setEnabled(payload.data.enabled);
      setReady(true);
    } catch {
      // Fail closed: panels stay disabled if status cannot be verified.
      setEnabled(false);
      setReady(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return (
    <AIKillSwitchContext.Provider value={{ enabled, ready, refresh }}>
      {children}
    </AIKillSwitchContext.Provider>
  );
}

export function useAIKillSwitch() {
  return useContext(AIKillSwitchContext);
}
