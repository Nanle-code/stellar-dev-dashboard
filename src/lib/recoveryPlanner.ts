/**
 * Recovery Priority Planner (#626)
 *
 * Classifies data criticality, assigns recovery priorities,
 * computes RTO/RPO targets, and generates optimal recovery sequences
 * to minimize downtime for critical operations.
 */

import { getStoredValue, setStoredValue } from './storage';

export interface RecoveryPriority {
  entityType: string;
  priority: number;
  rto: number;
  rpo: number;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  dependsOn: string[];
}

export interface RecoverySequence {
  step: number;
  entityType: string;
  action: string;
  estimatedDuration: number;
  criticalPath: boolean;
}

export interface RecoveryPlan {
  id: string;
  createdAt: number;
  priorities: RecoveryPriority[];
  sequence: RecoverySequence[];
  totalEstimatedDuration: number;
  totalDataSize: number;
  rtoCompliance: number;
  rpoCompliance: number;
}

export interface RecoveryPlannerState {
  plans: RecoveryPlan[];
  activePlanId: string | null;
  recoveryHistory: RecoveryEvent[];
}

export interface RecoveryEvent {
  id: string;
  timestamp: number;
  planId: string;
  status: 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  duration: number;
  entitiesRestored: number;
  dataRestored: number;
  errors: string[];
}

const STORAGE_KEY = 'recovery-planner:state';

const PRIORITY_MAP: Record<string, { priority: number; rto: number; rpo: number }> = {
  critical: { priority: 1, rto: 15, rpo: 5 },
  high: { priority: 2, rto: 60, rpo: 15 },
  medium: { priority: 3, rto: 240, rpo: 60 },
  low: { priority: 4, rto: 1440, rpo: 360 },
};

export class RecoveryPlanner {
  private state: RecoveryPlannerState;

  constructor(initialState?: Partial<RecoveryPlannerState>) {
    this.state = {
      plans: [],
      activePlanId: null,
      recoveryHistory: [],
      ...initialState,
    };
  }

  getState(): RecoveryPlannerState {
    return { ...this.state, plans: [...this.state.plans], recoveryHistory: [...this.state.recoveryHistory] };
  }

  // ─── Priority Classification ────────────────────────────────────────────

  classifyPriorities(importanceScores: Record<string, { entityType: string; score: number; criticality: string }>): RecoveryPriority[] {
    const priorities: RecoveryPriority[] = [];
    const dependencyGraph: Record<string, string[]> = {
      transactions: ['account', 'network'],
      account: ['network'],
      network: [],
      analytics: ['transactions'],
      settings: [],
      cache: ['account'],
      contracts: ['account'],
      notifications: ['account'],
    };

    for (const [entityType, score] of Object.entries(importanceScores)) {
      const config = PRIORITY_MAP[score.criticality] || PRIORITY_MAP.low;
      priorities.push({
        entityType,
        priority: config.priority,
        rto: config.rto,
        rpo: config.rpo,
        criticality: score.criticality as RecoveryPriority['criticality'],
        dependsOn: dependencyGraph[entityType] || [],
      });
    }

    priorities.sort((a, b) => a.priority - b.priority);
    return priorities;
  }

  // ─── Recovery Sequence Generation ───────────────────────────────────────

  generateSequence(priorities: RecoveryPriority[]): RecoverySequence[] {
    const sorted = [...priorities].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.rto - b.rto;
    });

    const sequence: RecoverySequence[] = [];
    const restored = new Set<string>();

    const resolveDependencies = (entityType: string, depth: number): void => {
      if (depth > 10) return;
      const entity = sorted.find((p) => p.entityType === entityType);
      if (!entity || restored.has(entityType)) return;
      for (const dep of entity.dependsOn) {
        resolveDependencies(dep, depth + 1);
      }
      if (!restored.has(entityType)) {
        sequence.push({
          step: sequence.length + 1,
          entityType: entity.entityType,
          action: entity.criticality === 'critical' ? 'restore_immediate' : 'restore_sequential',
          estimatedDuration: entity.rto * 0.3,
          criticalPath: entity.priority <= 2,
        });
        restored.add(entityType);
      }
    };

    for (const p of sorted) {
      if (!restored.has(p.entityType)) {
        resolveDependencies(p.entityType, 0);
      }
    }

    return sequence;
  }

  // ─── Plan Creation ──────────────────────────────────────────────────────

  createPlan(
    importanceScores: Record<string, { entityType: string; score: number; criticality: string }>,
    totalDataSize: number,
  ): RecoveryPlan {
    const priorities = this.classifyPriorities(importanceScores);
    const sequence = this.generateSequence(priorities);
    const totalEstimatedDuration = sequence.reduce((s, step) => s + step.estimatedDuration, 0);

    const rtoCompliance = priorities.length > 0
      ? priorities.filter((p) => p.rto >= totalEstimatedDuration / priorities.length).length / priorities.length
      : 0;

    const rpoCompliance = priorities.length > 0
      ? priorities.filter((p) => p.rpo >= 5).length / priorities.length
      : 0;

    const plan: RecoveryPlan = {
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      priorities,
      sequence,
      totalEstimatedDuration,
      totalDataSize,
      rtoCompliance: Math.round(rtoCompliance * 100),
      rpoCompliance: Math.round(rpoCompliance * 100),
    };

    this.state.plans.push(plan);
    this.state.activePlanId = plan.id;
    return plan;
  }

  getActivePlan(): RecoveryPlan | null {
    if (!this.state.activePlanId) return null;
    return this.state.plans.find((p) => p.id === this.state.activePlanId) || null;
  }

  // ─── Recovery Execution Tracking ────────────────────────────────────────

  startRecovery(planId: string): RecoveryEvent {
    const event: RecoveryEvent = {
      id: `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      planId,
      status: 'in_progress',
      duration: 0,
      entitiesRestored: 0,
      dataRestored: 0,
      errors: [],
    };
    this.state.recoveryHistory.push(event);
    this.state.activePlanId = planId;
    return event;
  }

  completeRecovery(eventId: string, entitiesRestored: number, dataRestored: number, errors: string[]): void {
    const event = this.state.recoveryHistory.find((e) => e.id === eventId);
    if (event) {
      event.status = errors.length > 0 ? 'failed' : 'completed';
      event.duration = Date.now() - event.timestamp;
      event.entitiesRestored = entitiesRestored;
      event.dataRestored = dataRestored;
      event.errors = errors;
    }
  }

  // ─── Analytics ──────────────────────────────────────────────────────────

  getComplianceReport(): { rtoCompliance: number; rpoCompliance: number; avgRecoveryTime: number } {
    const completed = this.state.recoveryHistory.filter((e) => e.status === 'completed');
    const avgRecoveryTime = completed.length > 0
      ? completed.reduce((s, e) => s + e.duration, 0) / completed.length
      : 0;

    const active = this.getActivePlan();
    return {
      rtoCompliance: active?.rtoCompliance ?? 0,
      rpoCompliance: active?.rpoCompliance ?? 0,
      avgRecoveryTime,
    };
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  async save(): Promise<void> {
    await setStoredValue(STORAGE_KEY, this.state);
  }

  static async load(): Promise<RecoveryPlanner> {
    try {
      const saved = await getStoredValue(STORAGE_KEY);
      if (saved) return new RecoveryPlanner(saved as Partial<RecoveryPlannerState>);
    } catch {
      // Fall back
    }
    return new RecoveryPlanner();
  }
}

let _instance: RecoveryPlanner | null = null;

export async function getRecoveryPlanner(): Promise<RecoveryPlanner> {
  if (!_instance) {
    _instance = await RecoveryPlanner.load();
  }
  return _instance;
}

export function resetRecoveryPlanner(): void {
  _instance = null;
}
