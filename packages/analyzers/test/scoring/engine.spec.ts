import { describe, expect, it } from 'vitest';
import { computeModuleScores, computeScores } from '../../src/scoring/engine.js';
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

  it('benefit-of-doubt cohesion when no module produces a signal', () => {
    // No cohesionWeighted/moduleLocSum passed → score defaults to 100.
    // Duplication weight is 0 so it contributes nothing regardless.
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
    expect(scores.overall).toBe(100);
    expect(scores.cohesion).toBe(100);
    expect(scores.duplication).toBe(100);
  });

  it('penalises a dual hub (high fanIn * fanOut) above the scaled threshold', () => {
    // 8 modules → dualHubStart = max(25, 8*4) = 32. dualHubMax 50 over 32 → penalty 27.
    const scores = computeScores({
      totalLoc: 1000,
      totalFunctions: 50,
      totalClasses: 0,
      totalComplexity: 50,
      cycleCount: 0,
      moduleCount: 8,
      fanOutTotal: 12,
      fanOutMax: 4,
      dualHubMax: 50,
      smells: [],
    });
    expect(scores.coupling).toBeLessThan(80);
  });

  it('scales the hub threshold by module count', () => {
    // 50 modules → hubStart = max(5, ceil(15)) = 15. fanOutMax 7 → no hub penalty.
    const scores = computeScores({
      totalLoc: 1000,
      totalFunctions: 50,
      totalClasses: 0,
      totalComplexity: 50,
      cycleCount: 0,
      moduleCount: 50,
      fanOutTotal: 50,
      fanOutMax: 7,
      smells: [],
    });
    // avgFanOut = 1.0 → avgPenalty = 0; hub doesn't fire; expect ~100.
    expect(scores.coupling).toBeGreaterThan(95);
  });

  it('penalises Martin pain modules in coupling', () => {
    // martinPainSum 3.0 → painPenalty 18 → coupling ~82.
    const scores = computeScores({
      totalLoc: 1000,
      totalFunctions: 50,
      totalClasses: 0,
      totalComplexity: 50,
      cycleCount: 0,
      moduleCount: 5,
      fanOutTotal: 4,
      fanOutMax: 2,
      martinPainSum: 3,
      smells: [],
    });
    expect(scores.coupling).toBeLessThan(85);
    expect(scores.coupling).toBeGreaterThan(70);
  });

  it('uses provided cohesion fields when signal is present', () => {
    // 60% cohesion weighted average → score 60.
    const scores = computeScores({
      totalLoc: 100,
      totalFunctions: 5,
      totalClasses: 0,
      totalComplexity: 5,
      cycleCount: 0,
      moduleCount: 2,
      fanOutTotal: 1,
      cohesionWeighted: 60,
      moduleLocSum: 100,
      smells: [],
    });
    expect(scores.cohesion).toBe(60);
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

describe('computeModuleScores', () => {
  it('scores a clean module near 100', () => {
    const sb = computeModuleScores({
      totalLoc: 500,
      hotSpotCount: 0,
      hotSpotExcess: 0,
      fanIn: 2,
      fanOut: 1,
      cohesionRatio: 0.9,
      smells: [],
      inCycle: false,
    });
    expect(sb.overall).toBeGreaterThan(95);
    expect(sb.complexity).toBe(100);
    expect(sb.cohesion).toBeGreaterThan(85);
  });

  it('penalises cycles in coupling', () => {
    const clean = computeModuleScores({
      totalLoc: 500,
      hotSpotCount: 0,
      hotSpotExcess: 0,
      fanIn: 2,
      fanOut: 2,
      cohesionRatio: 0.9,
      smells: [],
      inCycle: false,
    });
    const cyclic = computeModuleScores({
      totalLoc: 500,
      hotSpotCount: 0,
      hotSpotExcess: 0,
      fanIn: 2,
      fanOut: 2,
      cohesionRatio: 0.9,
      smells: [],
      inCycle: true,
    });
    expect(cyclic.coupling).toBeLessThan(clean.coupling);
  });

  it('drops cohesion when the module is incoherent', () => {
    const sb = computeModuleScores({
      totalLoc: 500,
      hotSpotCount: 0,
      hotSpotExcess: 0,
      fanIn: 1,
      fanOut: 1,
      cohesionRatio: 0.1,
      smells: [],
      inCycle: false,
    });
    expect(sb.cohesion).toBeLessThan(20);
  });

  it('marks duplication as off with a measurement note', () => {
    const sb = computeModuleScores({
      totalLoc: 500,
      hotSpotCount: 0,
      hotSpotExcess: 0,
      fanIn: 0,
      fanOut: 0,
      cohesionRatio: undefined,
      smells: [],
      inCycle: false,
    });
    expect(sb.measurementNotes?.duplication).toBeDefined();
    // Cohesion has no signal here either, so it should be noted too.
    expect(sb.measurementNotes?.cohesion).toBeDefined();
  });
});
