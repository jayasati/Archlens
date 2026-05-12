import { describe, expect, it } from 'vitest';
import { computeScores } from '../../src/scoring/engine.js';
import { scoreToGrade } from '../../src/scoring/grading.js';

describe('computeScores', () => {
  it('produces a perfect overall for a clean repo', () => {
    const scores = computeScores({
      totalLoc: 100,
      totalFunctions: 5,
      totalClasses: 1,
      totalComplexity: 10,
      cycleCount: 0,
      moduleCount: 2,
      fanOutTotal: 1,
      smells: [],
    });
    expect(scores.overall).toBeGreaterThan(95);
    expect(scoreToGrade(scores.overall)).toBe('A');
  });

  it('penalises cycles in coupling', () => {
    const scores = computeScores({
      totalLoc: 100,
      totalFunctions: 5,
      totalClasses: 1,
      totalComplexity: 10,
      cycleCount: 2,
      moduleCount: 2,
      fanOutTotal: 4,
      smells: [],
    });
    expect(scores.coupling).toBeLessThan(80);
  });

  it('drops complexity for hot-spot density even when average is low', () => {
    // 500 trivial functions (complexity 1) hide one cyclomatic-50 hot spot.
    // Old average-based formula scored this ~100; new hot-spot formula must penalise.
    const scores = computeScores({
      totalLoc: 1000,
      totalFunctions: 501,
      totalClasses: 0,
      totalComplexity: 500 + 50,
      cycleCount: 0,
      moduleCount: 5,
      fanOutTotal: 5,
      hotSpotCount: 1,
      hotSpotExcess: 40, // complexity 50 − threshold 10
      smells: [],
    });
    expect(scores.complexity).toBeLessThan(30);
  });

  it('penalises a single hub module via fanOutMax even when avg is low', () => {
    // 10 modules, total fanOut 12 (avg 1.2), but one module owns 10 of them.
    const scores = computeScores({
      totalLoc: 1000,
      totalFunctions: 50,
      totalClasses: 0,
      totalComplexity: 50,
      cycleCount: 0,
      moduleCount: 10,
      fanOutTotal: 12,
      fanOutMax: 10,
      smells: [],
    });
    expect(scores.coupling).toBeLessThan(85);
  });

  it('cohesion and duplication contribute nothing by default (weight 0)', () => {
    // A clean repo's overall should be a weighted blend of complexity / coupling / smells only.
    const scores = computeScores({
      totalLoc: 100,
      totalFunctions: 5,
      totalClasses: 0,
      totalComplexity: 5,
      cycleCount: 0,
      moduleCount: 2,
      fanOutTotal: 1,
      smells: [],
    });
    // complexity 100 * 0.4 + coupling 100 * 0.4 + smells 100 * 0.2 = 100.
    expect(scores.overall).toBe(100);
    expect(scores.cohesion).toBe(100);
    expect(scores.duplication).toBe(100);
  });
});

describe('scoreToGrade', () => {
  it('maps boundaries correctly', () => {
    expect(scoreToGrade(95)).toBe('A');
    expect(scoreToGrade(85)).toBe('B');
    expect(scoreToGrade(75)).toBe('C');
    expect(scoreToGrade(65)).toBe('D');
    expect(scoreToGrade(50)).toBe('E');
  });
});
