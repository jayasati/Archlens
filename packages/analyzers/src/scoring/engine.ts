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
  /** # functions whose cyclomatic > thresholds.longMethodComplexity. */
  hotSpotCount?: number;
  /** Σ (cyclomatic − threshold) over hot-spot functions. */
  hotSpotExcess?: number;
  /** Largest single-module fan-out, used for the hub-coupling penalty. */
  fanOutMax?: number;
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

  const hotSpotExcess = input.hotSpotExcess ?? 0;
  const hotSpotPerKloc = input.totalLoc > 0 ? (hotSpotExcess * 1000) / input.totalLoc : 0;
  const complexityScore = clamp(100 - hotSpotPerKloc * 2);

  const duplication = input.duplicationRatio ?? 0;
  const duplicationScore = clamp(100 - duplication * 100);

  const avgFanOut = input.moduleCount > 0 ? input.fanOutTotal / input.moduleCount : 0;
  const fanOutMax = input.fanOutMax ?? 0;
  const cyclePenalty = input.cycleCount * 15;
  const avgPenalty = Math.max(0, avgFanOut - 1) * 10;
  const hubPenalty = Math.max(0, fanOutMax - 5) * 4;
  const couplingScore = clamp(100 - avgPenalty - hubPenalty - cyclePenalty);

  // Cohesion: still a fake signal until phase 2 wires in real internal-connectivity.
  // Default weight is 0 so this dimension does not contribute to overall.
  const cohesionScore = 100;

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
