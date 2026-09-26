import { describe, it, expect, beforeEach, vi } from 'vitest';
import { learningHub } from '../learningHub';

describe('Learning Hub & Educational Materials (#908)', () => {
  beforeEach(() => {
    // Mock indexedDB for node/jsdom if necessary
    if (typeof indexedDB === 'undefined' || !indexedDB.open) {
      const mockRequest = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              get: () => ({ onsuccess: null, onerror: null }),
              put: () => ({ onsuccess: null, onerror: null }),
            }),
          }),
        },
        onsuccess: null as any,
        onerror: null as any,
      };
      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          setTimeout(() => {
            if (mockRequest.onsuccess) mockRequest.onsuccess();
          }, 0);
          return mockRequest;
        }),
      };
    }
  });

  it('initializes learning hub and loads tutorial catalogue', async () => {
    await learningHub.initialize();
    const tutorials = await learningHub.getAllTutorials();

    expect(tutorials.length).toBeGreaterThanOrEqual(4);

    // Locate sandbox analytics tutorial (#908)
    const sandboxTutorial = tutorials.find((t) => t.id === 'tut-4');
    expect(sandboxTutorial).toBeDefined();
    expect(sandboxTutorial?.title).toBe('Sandbox Analytics Demos');
    expect(sandboxTutorial?.category).toBe('advanced');
    expect(sandboxTutorial?.codeExamples.length).toBeGreaterThan(0);
    expect(sandboxTutorial?.quiz).toBeDefined();
    expect(sandboxTutorial?.quiz?.questions.length).toBe(2);
  });

  it('allows fetching sandbox analytics tutorial by ID', async () => {
    await learningHub.initialize();
    const tutorial = await learningHub.getTutorial('tut-4');

    expect(tutorial).toBeDefined();
    expect(tutorial?.description).toContain('anonymized account and trade datasets');
    expect(tutorial?.content).toContain('Zero Secret Keys');
  });
});
