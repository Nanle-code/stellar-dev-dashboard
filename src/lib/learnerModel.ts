import { v4 as uuidv4 } from 'uuid';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type LearningStyle = 'visual' | 'reading' | 'interactive' | 'video';
export type LearningPace = 'slow' | 'moderate' | 'fast';
export type UserGoal = 'explore' | 'build' | 'learn' | 'integrate';

export interface UserBackground {
  experienceLevel: ExperienceLevel;
  developmentExperience: string;
  blockchainExperience: string;
  stellarKnowledge: string;
  programmingLanguages: string[];
  goals: UserGoal[];
  learningStyle: LearningStyle;
  timeCommitment: string;
}

export interface InteractionEvent {
  tutorialId: string;
  eventType: 'start' | 'step_complete' | 'complete' | 'quiz_attempt' | 'quiz_pass' | 'quiz_fail' | 'skip' | 'replay';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SkillLevel {
  skillName: string;
  level: number;
  lastAssessed: number;
}

export interface TutorialCompletion {
  tutorialId: string;
  completedAt: number;
  score?: number;
  timeSpent: number;
  replays: number;
}

export interface LearnerModel {
  userId: string;
  profile: UserBackground;
  interactions: InteractionEvent[];
  completedTutorials: TutorialCompletion[];
  skillLevels: SkillLevel[];
  currentPace: LearningPace;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'stellar_learner_model';

export function loadLearnerModel(userId?: string): LearnerModel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LearnerModel;
  } catch {}
  return createDefaultModel(userId);
}

export function saveLearnerModel(model: LearnerModel): void {
  model.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {}
}

export function createDefaultModel(userId?: string): LearnerModel {
  return {
    userId: userId || uuidv4(),
    profile: {
      experienceLevel: 'beginner',
      developmentExperience: '',
      blockchainExperience: '',
      stellarKnowledge: '',
      programmingLanguages: [],
      goals: ['learn'],
      learningStyle: 'interactive',
      timeCommitment: '',
    },
    interactions: [],
    completedTutorials: [],
    skillLevels: [],
    currentPace: 'moderate',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updateProfile(model: LearnerModel, updates: Partial<UserBackground>): LearnerModel {
  model.profile = { ...model.profile, ...updates };
  return model;
}

export function recordInteraction(model: LearnerModel, event: Omit<InteractionEvent, 'timestamp'>): LearnerModel {
  model.interactions.push({ ...event, timestamp: Date.now() });
  if (model.interactions.length >= 500) {
    model.interactions = model.interactions.slice(-250);
  }
  return model;
}

export function recordTutorialCompletion(
  model: LearnerModel,
  tutorialId: string,
  timeSpent: number,
  score?: number,
): LearnerModel {
  const existing = model.completedTutorials.find((t) => t.tutorialId === tutorialId);
  if (existing) {
    existing.completedAt = Date.now();
    existing.timeSpent += timeSpent;
    existing.replays += 1;
    if (score !== undefined) existing.score = score;
  } else {
    model.completedTutorials.push({
      tutorialId,
      completedAt: Date.now(),
      timeSpent,
      replays: 0,
      score,
    });
  }
  return model;
}

export function updateSkillLevel(model: LearnerModel, skillName: string, level: number): LearnerModel {
  const existing = model.skillLevels.find((s) => s.skillName === skillName);
  if (existing) {
    existing.level = Math.max(0, Math.min(100, level));
    existing.lastAssessed = Date.now();
  } else {
    model.skillLevels.push({ skillName, level: Math.max(0, Math.min(100, level)), lastAssessed: Date.now() });
  }
  return model;
}

export function analyzePace(model: LearnerModel): LearningPace {
  const completions = model.completedTutorials;
  if (completions.length < 3) return model.currentPace;

  const recent = completions.slice(-5);
  const avgTime = recent.reduce((sum, t) => sum + t.timeSpent, 0) / recent.length;

  if (avgTime < 120000) return 'fast';
  if (avgTime > 600000) return 'slow';
  return 'moderate';
}

export function getCompetencyScore(model: LearnerModel): number {
  if (model.skillLevels.length === 0 && model.completedTutorials.length === 0) return 0;

  const skillAvg = model.skillLevels.length > 0
    ? model.skillLevels.reduce((sum, s) => sum + s.level, 0) / model.skillLevels.length
    : 0;

  const completionRate = model.interactions.length > 0
    ? model.interactions.filter((i) => i.eventType === 'complete').length /
      Math.max(1, model.interactions.filter((i) => i.eventType === 'start').length)
    : 0;

  return Math.round((skillAvg * 0.6 + completionRate * 100 * 0.4));
}

export function estimateTimeToCompetency(model: LearnerModel, targetCompetency: number = 80): number {
  const currentScore = getCompetencyScore(model);
  if (currentScore >= targetCompetency) return 0;

  const completions = model.completedTutorials;
  if (completions.length < 2) return 14;

  const avgTimePerTutorial = completions.reduce((sum, t) => sum + t.timeSpent, 0) / completions.length;
  const pointsPerTutorial = avgTimePerTutorial > 0 ? targetCompetency / Math.max(1, completions.length) : 5;
  const remaining = targetCompetency - currentScore;

  return Math.ceil((remaining / pointsPerTutorial) * avgTimePerTutorial) / 86400000;
}
