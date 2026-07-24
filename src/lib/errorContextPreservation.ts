const CONTEXT_STORAGE_KEY = 'app-error-context';

export interface ApplicationContext {
  timestamp: number;
  route: string;
  state: any;
  error?: {
    message: string;
    stack?: string;
    category?: string;
  };
}

export function saveErrorContext(route: string, state: any, error?: Error): void {
  try {
    const context: ApplicationContext = {
      timestamp: Date.now(),
      route,
      state,
      error: error ? {
        message: error.message,
        stack: error.stack,
        category: (error as any).category,
      } : undefined,
    };
    sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch (e) {
    console.error('Failed to save error context', e);
  }
}

export function restoreErrorContext(): ApplicationContext | null {
  try {
    const stored = sessionStorage.getItem(CONTEXT_STORAGE_KEY);
    if (!stored) return null;
    
    const context = JSON.parse(stored) as ApplicationContext;
    sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
    
    const age = Date.now() - context.timestamp;
    if (age > 600000) return null;
    
    return context;
  } catch (e) {
    console.error('Failed to restore error context', e);
    return null;
  }
}

export function clearErrorContext(): void {
  sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
}
