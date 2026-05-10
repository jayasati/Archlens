import type { Grade } from '@archlens/shared-types';

export const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: Grade }> = [
  { min: 90, grade: 'A' },
  { min: 75, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'E' },
];

export function scoreToGrade(score: number): Grade {
  const clamped = Math.max(0, Math.min(100, score));
  for (const { min, grade } of GRADE_THRESHOLDS) {
    if (clamped >= min) return grade;
  }
  return 'E';
}

const GRADE_COLORS: Record<Grade, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-grade-a', text: 'text-grade-a', ring: 'ring-grade-a/30' },
  B: { bg: 'bg-grade-b', text: 'text-grade-b', ring: 'ring-grade-b/30' },
  C: { bg: 'bg-grade-c', text: 'text-grade-c', ring: 'ring-grade-c/30' },
  D: { bg: 'bg-grade-d', text: 'text-grade-d', ring: 'ring-grade-d/30' },
  E: { bg: 'bg-grade-e', text: 'text-grade-e', ring: 'ring-grade-e/30' },
};

export function gradeColor(grade: Grade): { bg: string; text: string; ring: string } {
  return GRADE_COLORS[grade];
}

export function gradeLabel(grade: Grade): string {
  switch (grade) {
    case 'A':
      return 'Excellent';
    case 'B':
      return 'Good';
    case 'C':
      return 'Fair';
    case 'D':
      return 'Poor';
    case 'E':
      return 'Critical';
  }
}
