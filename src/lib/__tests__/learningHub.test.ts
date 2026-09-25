import { describe, it, expect, beforeEach, vi } from 'vitest';
import { learningHub } from '../learningHub';

describe('Learning Hub - Soroban Tutorials', () => {
  beforeEach(async () => {
    // Mock indexedDB if needed in jsdom
    if (!window.indexedDB) {
      // @ts-expect-error test mock
      window.indexedDB = {
        open: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        }),
      };
    }
  });

  it('initializes and contains Soroban debugging tutorials (tut-4, tut-5, tut-6)', async () => {
    // initialize tutorials in memory
    const tutorials = await learningHub.getAllTutorials();
    expect(tutorials.length).toBeGreaterThanOrEqual(6);

    const tut4 = await learningHub.getTutorial('tut-4');
    expect(tut4).toBeDefined();
    expect(tut4?.title).toContain('Simulation Errors');
    expect(tut4?.category).toBe('soroban');
    expect(tut4?.difficulty).toBe('beginner');
    expect(tut4?.codeExamples.length).toBeGreaterThan(0);
    expect(tut4?.quiz?.questions.length).toBeGreaterThan(0);

    const tut5 = await learningHub.getTutorial('tut-5');
    expect(tut5).toBeDefined();
    expect(tut5?.title).toContain('Declarative Authorization');
    expect(tut5?.category).toBe('soroban');
    expect(tut5?.difficulty).toBe('intermediate');

    const tut6 = await learningHub.getTutorial('tut-6');
    expect(tut6).toBeDefined();
    expect(tut6?.title).toContain('Ledger Footprints');
    expect(tut6?.category).toBe('soroban');
    expect(tut6?.difficulty).toBe('advanced');
  });

  it('filters tutorials by soroban category correctly', async () => {
    const sorobanTuts = await learningHub.getTutorialsByCategory('soroban');
    expect(sorobanTuts.length).toBeGreaterThanOrEqual(3);
    for (const t of sorobanTuts) {
      expect(t.category).toBe('soroban');
    }
  });

  it('returns null for non-existent tutorial id', async () => {
    const result = await learningHub.getTutorial('tut-non-existent-999');
    expect(result).toBeNull();
  });
});
