export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface MemoryLeak {
  detected: boolean;
  growthRate: number;
  samples: number;
}

const memorySnapshots: MemorySnapshot[] = [];
const MAX_SNAPSHOTS = 100;

export function captureMemorySnapshot(): MemorySnapshot | null {
  if (!('memory' in performance)) {
    return null;
  }

  const memory = (performance as any).memory;
  const snapshot: MemorySnapshot = {
    timestamp: Date.now(),
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  };

  memorySnapshots.push(snapshot);
  if (memorySnapshots.length > MAX_SNAPSHOTS) {
    memorySnapshots.shift();
  }

  return snapshot;
}

export function getMemorySnapshots(): MemorySnapshot[] {
  return [...memorySnapshots];
}

export function detectMemoryLeak(): MemoryLeak {
  if (memorySnapshots.length < 10) {
    return { detected: false, growthRate: 0, samples: memorySnapshots.length };
  }

  const recent = memorySnapshots.slice(-10);
  const first = recent[0];
  const last = recent[recent.length - 1];
  
  const timeDiff = last.timestamp - first.timestamp;
  const memoryDiff = last.usedJSHeapSize - first.usedJSHeapSize;
  const growthRate = (memoryDiff / timeDiff) * 1000;

  const threshold = 1024 * 1024;
  const detected = growthRate > threshold;

  return { detected, growthRate, samples: memorySnapshots.length };
}

export function startMemoryProfiling(intervalMs: number = 10000): () => void {
  const interval = setInterval(() => {
    captureMemorySnapshot();
    const leak = detectMemoryLeak();
    if (leak.detected) {
      console.warn('Potential memory leak detected', { growthRate: leak.growthRate });
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}
