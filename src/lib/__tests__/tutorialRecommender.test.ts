import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecommendedTutorials,
  getNextTutorial,
  getLearningPathProgress,
  type ScoredTutorial,
} from '../tutorialRecommender';
import { createDefaultModel, updateProfile, recordTutorialCompletion, updateSkillLevel, type LearnerModel } from '../learnerModel';

describe('TutorialRecommender', () => {
  let model: LearnerModel;

  beforeEach(() => {
    model = createDefaultModel('test-user');
    updateProfile(model, {
      experienceLevel: 'beginner',
      goals: ['learn'],
      learningStyle: 'interactive',
    });
  });

  it('returns beginner-friendly recommendations for new users', () => {
    const recommendations = getRecommendedTutorials(model, 5);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].score).toBeGreaterThan(0);
  });

  it('returns scored tutorials sorted by relevance', () => {
    const recs = getRecommendedTutorials(model, 10);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it('includes reason text for recommendations', () => {
    const recs = getRecommendedTutorials(model, 3);
    recs.forEach((rec) => {
      expect(rec.reason).toBeTruthy();
    });
  });

  it('returns fewer results than requested when not enough tutorials available', () => {
    const recs = getRecommendedTutorials(model, 100);
    expect(recs.length).toBeLessThanOrEqual(Object.keys(require('../tutorialSystem').TOURS).length);
  });

  it('excludes already completed tutorials', () => {
    recordTutorialCompletion(model, 'welcome', 180000, 90);
    const recs = getRecommendedTutorials(model, 10);
    const completedInRecs = recs.filter((r) => r.tourId === 'welcome');
    expect(completedInRecs).toHaveLength(0);
  });

  it('weights goal-relevant tutorials higher', () => {
    const learnModel = createDefaultModel('learner');
    updateProfile(learnModel, { goals: ['learn'], experienceLevel: 'beginner', learningStyle: 'interactive' });

    const buildModel = createDefaultModel('builder');
    updateProfile(buildModel, { goals: ['build'], experienceLevel: 'intermediate', learningStyle: 'interactive' });

    const learnRecs = getRecommendedTutorials(learnModel, 5);
    const buildRecs = getRecommendedTutorials(buildModel, 5);

    const learnGettingStarted = learnRecs.filter((r) => r.category === 'Getting Started').length;
    const buildGettingStarted = buildRecs.filter((r) => r.category === 'Getting Started').length;

    expect(learnGettingStarted).toBeGreaterThanOrEqual(buildGettingStarted);
  });

  it('adapts to experience level', () => {
    const beginnerModel = createDefaultModel('beginner');
    updateProfile(beginnerModel, { experienceLevel: 'beginner', goals: ['learn'], learningStyle: 'interactive' });

    const advancedModel = createDefaultModel('advanced');
    updateProfile(advancedModel, { experienceLevel: 'advanced', goals: ['build'], learningStyle: 'interactive' });

    const beginnerRecs = getRecommendedTutorials(beginnerModel, 5);
    const advancedRecs = getRecommendedTutorials(advancedModel, 5);

    const beginnerDifficulties = beginnerRecs.map((r) => r.difficulty);
    const advancedDifficulties = advancedRecs.map((r) => r.difficulty);

    expect(beginnerDifficulties.filter((d) => d === 'beginner').length).toBeGreaterThan(0);
    expect(advancedDifficulties.filter((d) => d === 'advanced').length).toBeGreaterThan(0);
  });

  it('returns next tutorial', () => {
    const next = getNextTutorial(model);
    expect(next).not.toBeNull();
    expect(next!.score).toBeGreaterThan(0);
  });

  it('returns null for next when all completed', () => {
    const tours = Object.keys(require('../tutorialSystem').TOURS);
    tours.forEach((t) => recordTutorialCompletion(model, t, 180000, 90));

    const next = getNextTutorial(model);
    expect(next).toBeNull();
  });

  it('tracks learning path progress', () => {
    const progress = getLearningPathProgress(model);
    expect(progress.completed).toBe(0);
    expect(progress.total).toBeGreaterThan(0);
    expect(progress.percentage).toBe(0);
  });

  it('progress reflects completed tutorials', () => {
    recordTutorialCompletion(model, 'welcome', 180000, 90);
    const progress = getLearningPathProgress(model);
    expect(progress.completed).toBe(1);
    expect(progress.percentage).toBeGreaterThan(0);
  });

  it('returns all ScoredTutorial fields', () => {
    const recs = getRecommendedTutorials(model, 1);
    expect(recs[0]).toHaveProperty('tourId');
    expect(recs[0]).toHaveProperty('title');
    expect(recs[0]).toHaveProperty('description');
    expect(recs[0]).toHaveProperty('category');
    expect(recs[0]).toHaveProperty('difficulty');
    expect(recs[0]).toHaveProperty('estimatedTime');
    expect(recs[0]).toHaveProperty('score');
    expect(recs[0]).toHaveProperty('reason');
  });
});
