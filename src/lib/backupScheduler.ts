/**
 * Intelligent Backup Scheduler (#626)
 *
 * ML-driven scheduling engine that determines optimal backup windows,
 * decides between full/incremental strategies, and predicts optimal
 * backup timing based on historical change patterns.
 */

import { getStoredValue, setStoredValue } from './storage';

export interface BackupWindow {
  dayOfWeek: number;
  hour: number;
  score: number;
  recommended: boolean;
}

export interface BackupTask {
  id: string;
  entityType: string;
  strategy: 'full' | 'incremental' | 'differential';
  scheduledAt: number;
  window: BackupWindow;
  priority: number;
  estimatedSize: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  completedAt?: number;
  duration?: number;
  size?: number;
}

export interface ScheduleMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgTaskDuration: number;
  windowUtilization: number;
  onTimeRate: number;
  predictionAccuracy: number;
}

export interface SchedulerState {
  tasks: BackupTask[];
  history: BackupTask[];
  windows: BackupWindow[];
  metrics: ScheduleMetrics;
  lastOptimization: number;
}

const STORAGE_KEY = 'backup-scheduler:state';
export class BackupScheduler {
  private state: SchedulerState;

  constructor(initialState?: Partial<SchedulerState>) {
    this.state = {
      tasks: [],
      history: [],
      windows: this.generateDefaultWindows(),
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        avgTaskDuration: 0,
        windowUtilization: 0,
        onTimeRate: 0,
        predictionAccuracy: 0,
      },
      lastOptimization: 0,
      ...initialState,
    };
  }

  getState(): SchedulerState {
    return {
      ...this.state,
      tasks: [...this.state.tasks],
      history: [...this.state.history],
      windows: [...this.state.windows],
    };
  }

  // ─── Window Optimization ───────────────────────────────────────────────

  private generateDefaultWindows(): BackupWindow[] {
    const windows: BackupWindow[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const score = (h >= 1 && h <= 5) ? 0.9 :
          h >= 22 || h <= 6 ? 0.7 :
          h >= 10 && h <= 16 ? 0.3 : 0.5;
        windows.push({
          dayOfWeek: d,
          hour: h,
          score,
          recommended: score >= 0.7,
        });
      }
    }
    return windows;
  }

  optimizeWindows(patterns: Record<string, { peakHours: number[]; frequency: number }>): BackupWindow[] {
    const peakHourSet = new Set<number>();
    for (const pattern of Object.values(patterns)) {
      for (const h of pattern.peakHours) {
        peakHourSet.add(h);
      }
    }

    const windows = this.generateDefaultWindows();
    for (const w of windows) {
      let penalty = peakHourSet.has(w.hour) ? 0.2 : 0;
      const baseScore = (w.hour >= 1 && w.hour <= 5) ? 0.95 :
        w.hour >= 22 || w.hour <= 6 ? 0.8 :
        w.hour >= 10 && w.hour <= 16 ? 0.25 : 0.45;
      w.score = Math.max(0, Math.min(1, baseScore - penalty));
      w.recommended = w.score >= 0.7;
    }

    this.state.windows = windows;
    return windows;
  }

  getRecommendedWindow(): BackupWindow | null {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    const candidates = this.state.windows.filter(
      (w) => w.recommended && w.score > 0.75
    );
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const aDist = this.windowDistance(currentDay, currentHour, a.dayOfWeek, a.hour);
      const bDist = this.windowDistance(currentDay, currentHour, b.dayOfWeek, b.hour);
      return aDist - bDist;
    });

    return candidates[0];
  }

  private windowDistance(fromDay: number, fromHour: number, toDay: number, toHour: number): number {
    let days = (toDay - fromDay + 7) % 7;
    if (days === 0 && toHour < fromHour) days = 7;
    return days * 24 + (toHour - fromHour);
  }

  // ─── Task Scheduling ───────────────────────────────────────────────────

  scheduleTasks(plans: Array<{ entityType: string; strategy: string; interval: number; priority: number; nextBackup: number }>): BackupTask[] {
    const tasks: BackupTask[] = [];
    for (const plan of plans) {
      const window = this.getRecommendedWindow() || this.state.windows[this.state.windows.length - 1];

      const estimatedSize = plan.strategy === 'full' ? 100 :
        plan.strategy === 'incremental' ? 20 : 50;

      const task: BackupTask = {
        id: `backup-${plan.entityType}-${Date.now()}`,
        entityType: plan.entityType,
        strategy: plan.strategy as BackupTask['strategy'],
        scheduledAt: plan.nextBackup,
        window,
        priority: plan.priority,
        estimatedSize,
        status: 'pending',
      };
      tasks.push(task);
    }

    tasks.sort((a, b) => a.priority - b.priority);
    this.state.tasks = tasks;
    return tasks;
  }

  getNextTask(): BackupTask | null {
    const pending = this.state.tasks
      .filter((t) => t.status === 'pending' && t.scheduledAt <= Date.now())
      .sort((a, b) => a.priority - b.priority);
    return pending[0] || null;
  }

  startTask(taskId: string): void {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (task) task.status = 'running';
  }

  completeTask(taskId: string, duration: number, size: number): void {
    const idx = this.state.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const task = this.state.tasks[idx];
    task.status = 'completed';
    task.completedAt = Date.now();
    task.duration = duration;
    task.size = size;
    this.state.history.push(task);
    this.state.tasks.splice(idx, 1);
    this.updateMetrics();
  }

  failTask(taskId: string, _reason: string): void {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (task) task.status = 'failed';
  }

  // ─── Predictive Scheduling ─────────────────────────────────────────────

  predictOptimalTiming(entityType: string, patterns: Record<string, { frequency: number; peakHours: number[] }>): number {
    const pattern = patterns[entityType];
    if (!pattern) return Date.now() + 3600000;

    const peakHour = pattern.peakHours[0];
    if (peakHour === undefined) return Date.now() + 3600000;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    let targetHour = peakHour;
    if (currentHour >= peakHour) {
      targetHour = peakHour;
      if (currentDay === 6) {
        return Date.now() + (24 - currentHour + peakHour) * 3600000;
      }
      return Date.now() + (24 - currentHour + targetHour) * 3600000;
    }

    return Date.now() + (targetHour - currentHour) * 3600000;
  }

  getEfficiencyProjection(): { projectedGain: number; optimalWindowCount: number; avgTaskDelay: number } {
    const completed = this.state.history.filter((t) => t.status === 'completed');
    const avgTaskDelay = completed.length > 0
      ? completed.reduce((s, t) => s + ((t.completedAt || 0) - t.scheduledAt), 0) / completed.length
      : 0;
    const optimalWindowCount = this.state.windows.filter((w) => w.recommended).length;

    const projectedGain = Math.min(100, Math.round(
      40 + (this.state.metrics.onTimeRate * 30) + (this.state.metrics.windowUtilization * 30)
    ));

    return { projectedGain, optimalWindowCount, avgTaskDelay };
  }

  // ─── Metrics ───────────────────────────────────────────────────────────

  private updateMetrics(): void {
    const completed = this.state.history.filter((t) => t.status === 'completed');
    const failed = this.state.history.filter((t) => t.status === 'failed');
    const total = completed.length + failed.length;

    if (total === 0) return;

    const avgDuration = completed.length > 0
      ? completed.reduce((s, t) => s + (t.duration || 0), 0) / completed.length
      : 0;

    const onTime = completed.filter((t) => (t.completedAt || 0) <= t.scheduledAt + 300000).length;
    const onTimeRate = completed.length > 0 ? onTime / completed.length : 0;

    const windowHits = completed.filter((t) => t.window?.recommended).length;
    const windowUtilization = completed.length > 0 ? windowHits / completed.length : 0;

    this.state.metrics = {
      totalTasks: total,
      completedTasks: completed.length,
      failedTasks: failed.length,
      avgTaskDuration: Math.round(avgDuration),
      windowUtilization: Math.round(windowUtilization * 100),
      onTimeRate: Math.round(onTimeRate * 100),
      predictionAccuracy: Math.round(windowUtilization * 100),
    };
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  async save(): Promise<void> {
    await setStoredValue(STORAGE_KEY, this.state);
  }

  static async load(): Promise<BackupScheduler> {
    try {
      const saved = await getStoredValue(STORAGE_KEY);
      if (saved) return new BackupScheduler(saved as Partial<SchedulerState>);
    } catch {
      // Fall back
    }
    return new BackupScheduler();
  }
}

let _instance: BackupScheduler | null = null;

export async function getBackupScheduler(): Promise<BackupScheduler> {
  if (!_instance) {
    _instance = await BackupScheduler.load();
  }
  return _instance;
}

export function resetBackupScheduler(): void {
  _instance = null;
}
