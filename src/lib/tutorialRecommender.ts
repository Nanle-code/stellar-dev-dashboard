import { TOURS } from './tutorialSystem';
import type { LearnerModel, LearningPace, ExperienceLevel, UserGoal } from './learnerModel';

export interface ScoredTutorial {
  tourId: string;
  title: string;
  description: string;
  category: string;
  difficulty: ExperienceLevel;
  estimatedTime: string;
  score: number;
  reason: string;
}

const DIFFICULTY_ORDER: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const PACE_MULTIPLIER: Record<LearningPace, number> = {
  slow: 0.7,
  moderate: 1.0,
  fast: 1.3,
};

function getCompletedTourIds(model: LearnerModel): Set<string> {
  return new Set(model.completedTutorials.map((t) => t.tutorialId));
}

function scoreDifficultyMatch(tourDifficulty: ExperienceLevel, modelLevel: ExperienceLevel): number {
  const tIdx = DIFFICULTY_ORDER[tourDifficulty];
  const mIdx = DIFFICULTY_ORDER[modelLevel];
  const diff = tIdx - mIdx;

  if (diff === 0) return 30;
  if (diff === 1) return 20;
  if (diff === -1) return 10;
  if (diff === 2) return 5;
  return 0;
}

function scoreGoalRelevance(tour: typeof TOURS[keyof typeof TOURS], goals: UserGoal[]): number {
  let score = 0;
  for (const goal of goals) {
    switch (goal) {
      case 'explore':
        if (tour.category === 'Getting Started') score += 15;
        break;
      case 'learn':
        if (['Getting Started', 'Core Features'].includes(tour.category)) score += 12;
        break;
      case 'build':
        if (['Core Features', 'Advanced', 'Soroban'].includes(tour.category)) score += 15;
        break;
      case 'integrate':
        if (['Advanced', 'Soroban', 'Trading'].includes(tour.category)) score += 12;
        break;
    }
  }
  return score;
}

function scoreLearningStyle(tour: typeof TOURS[keyof typeof TOURS], learningStyle: string): number {
  const hasVideo = !!tour.videoUrl;
  const hasInteractive = tour.steps.some((s) => s.interactiveHint);
  const hasAction = tour.steps.some((s) => s.action);

  switch (learningStyle) {
    case 'video':
      return hasVideo ? 15 : 5;
    case 'interactive':
      return hasInteractive && hasAction ? 15 : 8;
    case 'reading':
      return 12;
    case 'visual':
      return hasVideo || hasInteractive ? 12 : 6;
    default:
      return 10;
  }
}

function scorePaceAdaptation(
  tour: typeof TOURS[keyof typeof TOURS],
  pace: LearningPace,
): number {
  const timeMatch: Record<string, number> = {
    '3 min': 1,
    '4 min': 2,
    '5 min': 3,
    '6 min': 4,
    '7 min': 5,
  };
  const estimatedMinutes = timeMatch[tour.estimatedTime] || 3;

  const multiplier = PACE_MULTIPLIER[pace];
  const idealLength = 3 * multiplier;

  const diff = Math.abs(estimatedMinutes - idealLength);
  if (diff <= 0.5) return 15;
  if (diff <= 1) return 10;
  if (diff <= 2) return 5;
  return 0;
}

function scoreNovelty(tour: typeof TOURS[keyof typeof TOURS], completedIds: Set<string>): number {
  if (completedIds.has(tour.id)) return -100;
  if (completedIds.size === 0) return 20;
  return 10;
}

function scorePrerequisites(
  tour: typeof TOURS[keyof typeof TOURS],
  completedIds: Set<string>,
): number {
  if (!tour.prerequisites || tour.prerequisites.length === 0) return 20;
  const allMet = tour.prerequisites.every((p) => completedIds.has(p));
  if (allMet) return 20;
  const someMet = tour.prerequisites.some((p) => completedIds.has(p));
  if (someMet) return 5;
  return -50;
}

function scoreVariety(tour: typeof TOURS[keyof typeof TOURS], recentCategories: string[]): number {
  if (recentCategories.length === 0) return 10;
  if (!recentCategories.includes(tour.category)) return 10;
  return 0;
}

export function getRecommendedTutorials(
  model: LearnerModel,
  count: number = 5,
): ScoredTutorial[] {
  const tours = Object.values(TOURS);
  const completedIds = getCompletedTourIds(model);
  const recentCategories = model.completedTutorials
    .slice(-3)
    .map((t) => {
      const tour = tours.find((tr) => tr.id === t.tutorialId);
      return tour?.category || '';
    })
    .filter(Boolean);

  const scored: ScoredTutorial[] = tours.map((tour) => {
    const scores = {
      difficulty: scoreDifficultyMatch(tour.difficulty as ExperienceLevel, model.profile.experienceLevel),
      goal: scoreGoalRelevance(tour, model.profile.goals),
      style: scoreLearningStyle(tour, model.profile.learningStyle),
      pace: scorePaceAdaptation(tour, model.currentPace),
      novelty: scoreNovelty(tour, completedIds),
      prerequisites: scorePrerequisites(tour, completedIds),
      variety: scoreVariety(tour, recentCategories),
    };

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);

    const reasons: string[] = [];
    if (scores.difficulty >= 20) reasons.push('matches your experience level');
    if (scores.goal >= 12) reasons.push('aligns with your goals');
    if (scores.prerequisites >= 20) reasons.push('all prerequisites completed');
    if (scores.pace >= 15) reasons.push('fits your learning pace');

    return {
      tourId: tour.id,
      title: tour.title,
      description: tour.description,
      category: tour.category,
      difficulty: tour.difficulty as ExperienceLevel,
      estimatedTime: tour.estimatedTime,
      score: totalScore,
      reason: reasons.length > 0 ? reasons.join(', ') : 'recommended for you',
    };
  });

  return scored
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

export function getNextTutorial(model: LearnerModel): ScoredTutorial | null {
  const recommendations = getRecommendedTutorials(model, 1);
  return recommendations[0] || null;
}

export function getLearningPathProgress(model: LearnerModel): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = Object.keys(TOURS).length;
  const completed = model.completedTutorials.length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
