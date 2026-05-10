import type { AnalyzerWeights } from '../adapters/adapter.interface.js';
import type { ScoreBreakdown, Smell, Severity } from '../ir/types.js';
import { mergeWeights } from './weights.default.js';

export interface ScoreInput {
  totalLoc: number;
  totalFunctions: number;
  totalClasses: number;
  totalComplexity: number;
  cycleCount: number;
  moduleCount: number;
  fanOutTotal: number;
  smells: Smell[];
  duplicationRatio?: number;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 1,
  minor: 2,
  major: 5,
  critical: 10,
};

export function computeScores(
  input: ScoreInput,
  weights?: Partial<AnalyzerWeights>
): ScoreBreakdown {
  const merged = mergeWeights(weights);

  const avgComplexity = input.totalFunctions > 0 ? input.totalComplexity / input.totalFunctions : 0;
  const complexityScore = clamp(100 - Math.max(0, avgComplexity - 3) * 8);

  const duplication = input.duplicationRatio ?? 0;
  const duplicationScore = clamp(100 - duplication * 100);

  const avgFanOut = input.moduleCount > 0 ? input.fanOutTotal / input.moduleCount : 0;
  const cyclePenalty = input.cycleCount * 15;
  const couplingScore = clamp(100 - Math.max(0, avgFanOut - 2) * 10 - cyclePenalty);

  const cohesionScore = clamp(100 - Math.max(0, avgFanOut - 3) * 6);

  const smellPenalty = input.smells.reduce((sum, s) => sum + SEVERITY_WEIGHT[s.severity], 0);
  const smellPerKloc = input.totalLoc > 0 ? (smellPenalty * 1000) / input.totalLoc : 0;
  const smellsScore = clamp(100 - smellPerKloc * 4);

  const overall = clamp(
    complexityScore * merged.complexity +
      duplicationScore * merged.duplication +
      couplingScore * merged.coupling +
      cohesionScore * merged.cohesion +
      smellsScore * merged.smells
  );

  return {
    complexity: round(complexityScore),
    duplication: round(duplicationScore),
    coupling: round(couplingScore),
    cohesion: round(cohesionScore),
    smells: round(smellsScore),
    overall: round(overall),
  };
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
