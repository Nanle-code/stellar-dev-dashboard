import { TOURS } from './tutorialSystem';
import type { LearnerModel, ExperienceLevel, LearningPace, UserGoal } from './learnerModel';
import { analyzePace, getCompetencyScore } from './learnerModel';

export interface LearningPathStep {
  tourId: string;
  title: string;
  description: string;
  difficulty: ExperienceLevel;
  estimatedTime: string;
  category: string;
  order: number;
  completed: boolean;
  locked: boolean;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  steps: LearningPathStep[];
  pace: LearningPace;
  estimatedTotalTime: string;
  competencyTarget: number;
}

const DIFFICULTY_ORDER: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

function getGoalBasedPathName(goals: UserGoal[]): string {
  if (goals.includes('build')) return 'Builder Track';
  if (goals.includes('integrate')) return 'Integration Track';
  if (goals.includes('learn')) return 'Learning Track';
  if (goals.includes('explore')) return 'Exploration Track';
  return 'Standard Track';
}

function getGoalBasedDescription(goals: UserGoal[]): string {
  if (goals.includes('build')) return 'Focused on building and deploying on Stellar';
  if (goals.includes('integrate')) return 'Learn to integrate Stellar into existing systems';
  if (goals.includes('learn')) return 'Comprehensive learning path from basics to advanced';
  if (goals.includes('explore')) return 'Explore Stellar ecosystem at your own pace';
  return 'A balanced path covering all aspects of Stellar development';
}

export function generateLearningPath(model: LearnerModel): LearningPath {
  const tours = Object.values(TOURS);
  const completedIds = new Set(model.completedTutorials.map((t) => t.tutorialId));
  const pace = analyzePace(model);
  const competencyTarget = Math.min(100, getCompetencyScore(model) + 40);

  const sorted = [...tours].sort((a, b) => {
    const aDiff = DIFFICULTY_ORDER[a.difficulty as ExperienceLevel] || 1;
    const bDiff = DIFFICULTY_ORDER[b.difficulty as ExperienceLevel] || 1;
    if (aDiff !== bDiff) return aDiff - bDiff;

    const aIsRelevant = model.profile.goals.some((g) => {
      if (g === 'build') return ['Core Features', 'Advanced', 'Soroban'].includes(a.category);
      if (g === 'learn') return ['Getting Started', 'Core Features'].includes(a.category);
      if (g === 'explore') return ['Getting Started', 'Analytics', 'Trading'].includes(a.category);
      if (g === 'integrate') return ['Advanced', 'Soroban', 'Security'].includes(a.category);
      return true;
    });
    const bIsRelevant = model.profile.goals.some((g) => {
      if (g === 'build') return ['Core Features', 'Advanced', 'Soroban'].includes(b.category);
      if (g === 'learn') return ['Getting Started', 'Core Features'].includes(b.category);
      if (g === 'explore') return ['Getting Started', 'Analytics', 'Trading'].includes(b.category);
      if (g === 'integrate') return ['Advanced', 'Soroban', 'Security'].includes(b.category);
      return true;
    });
    return aIsRelevant === bIsRelevant ? 0 : aIsRelevant ? -1 : 1;
  });

  const steps: LearningPathStep[] = [];
  let unlocked = true;
  let processed = 0;

  for (const tour of sorted) {
    const isCompleted = completedIds.has(tour.id);
    const prerequisitesMet = !tour.prerequisites ||
      tour.prerequisites.every((p) => completedIds.has(p));

    if (!isCompleted && !prerequisitesMet && unlocked) {
      unlocked = false;
    }

    steps.push({
      tourId: tour.id,
      title: tour.title,
      description: tour.description,
      difficulty: tour.difficulty as ExperienceLevel,
      estimatedTime: tour.estimatedTime,
      category: tour.category,
      order: processed + 1,
      completed: isCompleted,
      locked: !isCompleted && !(unlocked && prerequisitesMet),
    });

    if (!isCompleted && prerequisitesMet) {
      unlocked = true;
    }

    processed++;
  }

  const timeValues: Record<string, number> = {
    '3 min': 3,
    '4 min': 4,
    '5 min': 5,
    '6 min': 6,
    '7 min': 7,
  };
  const totalMinutes = steps.reduce((sum, s) => sum + (timeValues[s.estimatedTime] || 5), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const estimatedTotalTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return {
    id: `path-${Date.now()}`,
    name: getGoalBasedPathName(model.profile.goals),
    description: getGoalBasedDescription(model.profile.goals),
    steps,
    pace,
    estimatedTotalTime,
    competencyTarget,
  };
}

export function adaptLearningPath(path: LearningPath, model: LearnerModel): LearningPath {
  const newPace = analyzePace(model);
  path.pace = newPace;

  const completedIds = new Set(model.completedTutorials.map((t) => t.tutorialId));

  for (let i = 0; i < path.steps.length; i++) {
    const step = path.steps[i];
    step.completed = completedIds.has(step.tourId);

    const tour = TOURS[step.tourId];
    if (!tour) continue;

    const prerequisitesMet = !tour.prerequisites ||
      tour.prerequisites.every((p) => completedIds.has(p));

    const previousUnlocked = i === 0 || path.steps[i - 1].completed || !path.steps[i - 1].locked;
    step.locked = !step.completed && !(previousUnlocked && prerequisitesMet);
  }

  path.competencyTarget = Math.min(100, getCompetencyScore(model) + 40);
  return path;
}

export function getPaceLabel(pace: LearningPace): string {
  switch (pace) {
    case 'slow': return 'Slow - Take your time with each tutorial';
    case 'moderate': return 'Moderate - Balanced learning pace';
    case 'fast': return 'Fast - Move quickly through content';
  }
}

export function formatTimeEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
