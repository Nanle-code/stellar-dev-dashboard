import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultModel,
  updateProfile,
  recordInteraction,
  recordTutorialCompletion,
  updateSkillLevel,
  analyzePace,
  getCompetencyScore,
  estimateTimeToCompetency,
  type LearnerModel,
  type UserBackground,
} from '../learnerModel';

describe('LearnerModel', () => {
  let model: LearnerModel;

  beforeEach(() => {
    model = createDefaultModel('test-user');
  });

  it('creates a default model with beginner settings', () => {
    expect(model.userId).toBe('test-user');
    expect(model.profile.experienceLevel).toBe('beginner');
    expect(model.profile.goals).toEqual(['learn']);
    expect(model.currentPace).toBe('moderate');
    expect(model.interactions).toEqual([]);
    expect(model.completedTutorials).toEqual([]);
    expect(model.skillLevels).toEqual([]);
  });

  it('updates profile fields', () => {
    const updated = updateProfile(model, {
      experienceLevel: 'intermediate',
      goals: ['build', 'learn'],
      learningStyle: 'visual',
    });

    expect(updated.profile.experienceLevel).toBe('intermediate');
    expect(updated.profile.goals).toEqual(['build', 'learn']);
    expect(updated.profile.learningStyle).toBe('visual');
  });

  it('records interaction events', () => {
    recordInteraction(model, { tutorialId: 'welcome', eventType: 'start' });
    recordInteraction(model, { tutorialId: 'welcome', eventType: 'step_complete' });
    recordInteraction(model, { tutorialId: 'welcome', eventType: 'complete' });

    expect(model.interactions).toHaveLength(3);
    expect(model.interactions[0].eventType).toBe('start');
    expect(model.interactions[2].eventType).toBe('complete');
  });

  it('caps interactions at 250 after exceeding 500', () => {
    for (let i = 0; i < 600; i++) {
      recordInteraction(model, { tutorialId: `tut-${i}`, eventType: 'start' });
    }
    expect(model.interactions.length).toBe(350);
  });

  it('records tutorial completion', () => {
    recordTutorialCompletion(model, 'welcome', 180000, 85);
    expect(model.completedTutorials).toHaveLength(1);
    expect(model.completedTutorials[0].tutorialId).toBe('welcome');
    expect(model.completedTutorials[0].timeSpent).toBe(180000);
    expect(model.completedTutorials[0].score).toBe(85);
  });

  it('increments replays on repeated tutorial completion', () => {
    recordTutorialCompletion(model, 'welcome', 120000, 90);
    recordTutorialCompletion(model, 'welcome', 60000, 95);

    expect(model.completedTutorials).toHaveLength(1);
    expect(model.completedTutorials[0].replays).toBe(1);
    expect(model.completedTutorials[0].timeSpent).toBe(180000);
    expect(model.completedTutorials[0].score).toBe(95);
  });

  it('updates skill levels within bounds', () => {
    updateSkillLevel(model, 'stellar-basics', 50);
    updateSkillLevel(model, 'transaction-building', 75);
    updateSkillLevel(model, 'smart-contracts', 120);
    updateSkillLevel(model, 'over-9000', -5);

    expect(model.skillLevels).toHaveLength(4);
    expect(model.skillLevels[0].level).toBe(50);
    expect(model.skillLevels[1].level).toBe(75);
    expect(model.skillLevels[2].level).toBe(100);
    expect(model.skillLevels[3].level).toBe(0);
  });

  it('analyzes pace as moderate when few tutorials completed', () => {
    recordTutorialCompletion(model, 'welcome', 300000);
    const pace = analyzePace(model);
    expect(pace).toBe('moderate');
  });

  it('analyzes pace as fast when completions are quick', () => {
    for (let i = 0; i < 5; i++) {
      recordTutorialCompletion(model, `tut-${i}`, 60000);
    }
    const pace = analyzePace(model);
    expect(pace).toBe('fast');
  });

  it('analyzes pace as slow when completions take long', () => {
    for (let i = 0; i < 5; i++) {
      recordTutorialCompletion(model, `tut-${i}`, 900000);
    }
    const pace = analyzePace(model);
    expect(pace).toBe('slow');
  });

  it('returns 0 competency for new users', () => {
    expect(getCompetencyScore(model)).toBe(0);
  });

  it('calculates competency score based on skills and completions', () => {
    updateSkillLevel(model, 'stellar-basics', 80);
    updateSkillLevel(model, 'transactions', 60);

    recordInteraction(model, { tutorialId: 'welcome', eventType: 'start' });
    recordInteraction(model, { tutorialId: 'welcome', eventType: 'complete' });
    recordInteraction(model, { tutorialId: 'wallet', eventType: 'start' });
    recordInteraction(model, { tutorialId: 'wallet', eventType: 'complete' });

    const score = getCompetencyScore(model);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('estimates time to competency', () => {
    const days = estimateTimeToCompetency(model, 80);
    expect(days).toBe(14);
  });

  it('returns 0 time to competency when target is already met', () => {
    updateSkillLevel(model, 'stellar-basics', 100);
    updateSkillLevel(model, 'transactions', 100);
    recordInteraction(model, { tutorialId: 'welcome', eventType: 'start' });
    recordInteraction(model, { tutorialId: 'welcome', eventType: 'complete' });
    recordInteraction(model, { tutorialId: 'wallet', eventType: 'start' });
    recordInteraction(model, { tutorialId: 'wallet', eventType: 'complete' });
    const days = estimateTimeToCompetency(model, 80);
    expect(days).toBe(0);
  });
});
