import { describe, it, expect } from 'vitest';
import { scoreToGrade, gradeColor, gradeLabel } from '@/lib/utils/grade';

describe('scoreToGrade', () => {
  it.each([
    [100, 'A'],
    [95, 'A'],
    [90, 'A'],
    [89.99, 'B'],
    [80, 'B'],
    [75, 'B'],
    [74.99, 'C'],
    [60, 'C'],
    [59.99, 'D'],
    [40, 'D'],
    [39.99, 'E'],
    [10, 'E'],
    [0, 'E'],
  ])('maps %s to %s', (score, expected) => {
    expect(scoreToGrade(score)).toBe(expected);
  });

  it('clamps values above 100 to A', () => {
    expect(scoreToGrade(150)).toBe('A');
  });

  it('clamps negative values to E', () => {
    expect(scoreToGrade(-20)).toBe('E');
  });
});

describe('gradeColor', () => {
  it('returns a color triple for every grade', () => {
    for (const g of ['A', 'B', 'C', 'D', 'E'] as const) {
      const c = gradeColor(g);
      expect(c.bg).toMatch(/^bg-grade-/);
      expect(c.text).toMatch(/^text-grade-/);
      expect(c.ring).toMatch(/^ring-grade-/);
    }
  });

  it('A and E use distinct colors', () => {
    expect(gradeColor('A')).not.toEqual(gradeColor('E'));
  });
});

describe('gradeLabel', () => {
  it('returns a non-empty label for every grade', () => {
    for (const g of ['A', 'B', 'C', 'D', 'E'] as const) {
      expect(gradeLabel(g).length).toBeGreaterThan(0);
    }
  });
});
