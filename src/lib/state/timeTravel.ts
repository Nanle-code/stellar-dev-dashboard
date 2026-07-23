/**
 * Time Travel Debugging System - D-025
 * State history recording, diff visualization, and rollback capabilities
 */

import { create } from 'zustand';

export interface StateSnapshot {
  id: string;
  timestamp: number;
  state: unknown;
  action: string;
  metadata?: Record<string, unknown>;
}

export interface StateDiff {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'added' | 'removed' | 'changed' | 'moved';
}

export interface StateAnalytics {
  changeFrequency: Record<string, number>;
  stateSize: number[];
  averageStateSize: number;
  totalChanges: number;
  timeRange: { start: number; end: number } | null;
}

interface TimeTravelState {
  history: StateSnapshot[];
  currentIndex: number;
  isRecording: boolean;
  maxHistory: number;

  // Actions
  recordState: (state: unknown, action: string, metadata?: Record<string, unknown>) => void;
  undo: () => void;
  redo: () => void;
  goToIndex: (index: number) => void;
  clearHistory: () => void;
  toggleRecording: () => void;
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (id: string) => void;
  
  // Analytics
  getAnalytics: () => StateAnalytics;
  getDiff: (fromIndex: number, toIndex: number) => StateDiff[];
  exportHistory: () => string;
  importHistory: (data: string) => void;
}

export const useTimeTravel = create<TimeTravelState>((set, get) => ({
  history: [],
  currentIndex: -1,
  isRecording: true,
  maxHistory: 100,

  recordState: (state, action, metadata) => {
    const { isRecording, history, currentIndex, maxHistory } = get();
    if (!isRecording) return;

    const snapshot: StateSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      action,
      metadata,
    };

    // Remove any future states if we're not at the end
    const newHistory = currentIndex >= 0 ? history.slice(0, currentIndex + 1) : [...history];
    newHistory.push(snapshot);

    // Keep within max history
    if (newHistory.length > maxHistory) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      currentIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { currentIndex, history } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
      return history[currentIndex - 1].state;
    }
    return null;
  },

  redo: () => {
    const { currentIndex, history } = get();
    if (currentIndex < history.length - 1) {
      set({ currentIndex: currentIndex + 1 });
      return history[currentIndex + 1].state;
    }
    return null;
  },

  goToIndex: (index) => {
    const { history } = get();
    if (index >= 0 && index < history.length) {
      set({ currentIndex: index });
      return history[index].state;
    }
    return null;
  },

  clearHistory: () => {
    set({
      history: [],
      currentIndex: -1,
    });
  },

  toggleRecording: () => {
    set((state) => ({ isRecording: !state.isRecording }));
  },

  saveSnapshot: (name) => {
    const { history, currentIndex } = get();
    if (currentIndex >= 0) {
      const snapshot = { ...history[currentIndex], id: `snapshot-${Date.now()}` };
      // In a real implementation, this would persist to IndexedDB
      console.log('Saved snapshot:', name, snapshot);
    }
  },

  restoreSnapshot: (id) => {
    const { history } = get();
    const index = history.findIndex(s => s.id === id);
    if (index >= 0) {
      set({ currentIndex: index });
      return history[index].state;
    }
    return null;
  },

  getAnalytics: () => {
    const { history } = get();
    if (history.length === 0) {
      return {
        changeFrequency: {},
        stateSize: [],
        averageStateSize: 0,
        totalChanges: 0,
        timeRange: null,
      };
    }

    const changeFrequency: Record<string, number> = {};
    const stateSize: number[] = [];

    history.forEach(snapshot => {
      changeFrequency[snapshot.action] = (changeFrequency[snapshot.action] || 0) + 1;
      stateSize.push(JSON.stringify(snapshot.state).length);
    });

    const totalChanges = history.length;
    const averageStateSize = stateSize.reduce((a, b) => a + b, 0) / stateSize.length;

    return {
      changeFrequency,
      stateSize,
      averageStateSize,
      totalChanges,
      timeRange: {
        start: history[0].timestamp,
        end: history[history.length - 1].timestamp,
      },
    };
  },

  getDiff: (fromIndex, toIndex) => {
    const { history } = get();
    if (fromIndex < 0 || toIndex >= history.length || fromIndex > toIndex) {
      return [];
    }

    const fromState = history[fromIndex].state;
    const toState = history[toIndex].state;
    const diffs: StateDiff[] = [];

    const compareObjects = (obj1: unknown, obj2: unknown, path = ''): void => {
      if (obj1 === obj2) return;

      if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
        diffs.push({
          path,
          oldValue: obj1,
          newValue: obj2,
          type: obj1 === undefined ? 'added' : obj2 === undefined ? 'removed' : 'changed',
        });
        return;
      }

      const keys1 = Object.keys(obj1 as Record<string, unknown>);
      const keys2 = Object.keys(obj2 as Record<string, unknown>);
      const allKeys = new Set([...keys1, ...keys2]);

      allKeys.forEach(key => {
        const newPath = path ? `${path}.${key}` : key;
        const val1 = (obj1 as Record<string, unknown>)[key];
        const val2 = (obj2 as Record<string, unknown>)[key];

        if (!(key in obj1)) {
          diffs.push({ path: newPath, oldValue: undefined, newValue: val2, type: 'added' });
        } else if (!(key in obj2)) {
          diffs.push({ path: newPath, oldValue: val1, newValue: undefined, type: 'removed' });
        } else {
          compareObjects(val1, val2, newPath);
        }
      });
    };

    compareObjects(fromState, toState);
    return diffs;
  },

  exportHistory: () => {
    const { history } = get();
    return JSON.stringify(history, null, 2);
  },

  importHistory: (data) => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        set({
          history: parsed,
          currentIndex: parsed.length - 1,
        });
      }
    } catch (error) {
      console.error('Failed to import history:', error);
    }
  },
}));
