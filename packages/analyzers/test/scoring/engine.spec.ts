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
