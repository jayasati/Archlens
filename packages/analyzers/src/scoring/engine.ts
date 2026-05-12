import type { AnalyzerWeights } from '../adapters/adapter.interface.js';
import type { ScoreBreakdown, Smell, Severity } from '../ir/types.js';
import { mergeWeights } from './weights.default.js';

type Dimension = 'complexity' | 'duplication' | 'coupling' | 'cohesion' | 'smells';
type MeasurementNotes = Partial<Record<Dimension, string>>;
type Derivation = Partial<Record<Dimension, string>>;

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
  /** Largest fan-in × fan-out across modules — flags god-modules (high consume + high provide). */
  dualHubMax?: number;
  /** Σ max(0, martinDistance - 0.5) over modules with abstractness defined; pain-zone aggregate. */
  martinPainSum?: number;
  /** Σ (cohesionRatio_M × loc_M) across modules that produced a cohesion signal. */
  cohesionWeighted?: number;
  /** Σ loc_M for the same set of modules. */
  moduleLocSum?: number;
}

/**
 * Per-severity penalty rate (points per smell per KLOC). Calibrated so that
 * a typical real repo lands in the 50–80 band rather than flooring at 0:
 *   - 1 critical / 1000 LOC roughly halves the score
 *   - ~2 major / 1000 LOC produces a small but visible penalty
 *   - minor and info contribute background pressure
 */
const SEVERITY_PENALTY_PER_KLOC: Record<Severity, number> = {
  critical: 25,
  major: 6,
  minor: 1.5,
  info: 0.3,
};

/** Floor LOC for rate denominators so a tiny repo with 1 smell doesn't tank. */
const MIN_RATE_LOC = 500;

export function computeScores(
  input: ScoreInput,
  weights?: Partial<AnalyzerWeights>
): ScoreBreakdown {
  const merged = mergeWeights(weights);
  const notes: MeasurementNotes = {};
  const derivation: Derivation = {};

  // ── Complexity ────────────────────────────────────────────────────────
  const hotSpotCount = input.hotSpotCount ?? 0;
  const hotSpotExcess = input.hotSpotExcess ?? 0;
  const hotSpotPerKloc = input.totalLoc > 0 ? (hotSpotExcess * 1000) / input.totalLoc : 0;
  const complexityScore = clamp(100 - hotSpotPerKloc * 2);
  if (input.totalFunctions === 0) {
    notes.complexity = 'limited signal — no functions detected';
  }
  derivation.complexity =
    `100 − hot-spot density × 2 = ${complexityScore.toFixed(0)} ` +
    `(${hotSpotCount} hot-spot function${hotSpotCount === 1 ? '' : 's'} over ${input.totalLoc.toLocaleString()} LOC)`;

  // ── Duplication ───────────────────────────────────────────────────────
  // `undefined` means jscpd was explicitly skipped (orchestrator passed null).
  // A run with zero clones still yields `0`, so we can distinguish "off" from "clean".
  let duplicationScore: number;
  if (input.duplicationRatio === undefined) {
    duplicationScore = 100;
    notes.duplication = 'off — detection skipped';
    derivation.duplication = 'detection skipped (config.skipDuplication)';
  } else {
    duplicationScore = clamp(100 - input.duplicationRatio * 100);
    derivation.duplication =
      `100 − duplicate-lines ratio × 100 = ${duplicationScore.toFixed(0)} ` +
      `(${(input.duplicationRatio * 100).toFixed(1)}% of lines duplicated)`;
  }

  // ── Coupling ──────────────────────────────────────────────────────────
  const avgFanOut = input.moduleCount > 0 ? input.fanOutTotal / input.moduleCount : 0;
  const fanOutMax = input.fanOutMax ?? 0;
  const dualHubMax = input.dualHubMax ?? 0;
  const martinPain = input.martinPainSum ?? 0;
  const cyclePenalty = input.cycleCount * 15;
  const avgPenalty = Math.max(0, avgFanOut - 1) * 10;
  // Hub threshold scales with moduleCount so large repos aren't drowning in
  // false-positive hubs and tiny repos still feel a floor.
  const hubStart = Math.max(5, Math.ceil(input.moduleCount * 0.3));
  const hubPenalty = Math.max(0, fanOutMax - hubStart) * 4;
  // Dual-hub = high fanIn × fanOut, the god-module signature.
  const dualHubStart = Math.max(25, input.moduleCount * 4);
  const dualHubPenalty = Math.max(0, dualHubMax - dualHubStart) * 1.5;
  const painPenalty = martinPain * 6;
  const couplingScore = clamp(
    100 - avgPenalty - hubPenalty - dualHubPenalty - painPenalty - cyclePenalty
  );
  if (input.moduleCount <= 1) {
    notes.coupling = 'limited signal — single module';
  } else if (input.fanOutTotal === 0) {
    notes.coupling = 'limited signal — no cross-module imports detected';
  }
  derivation.coupling =
    `100 − avg-fanOut penalty − hub penalty − dual-hub penalty − cycle penalty = ${couplingScore.toFixed(0)} ` +
    `(${input.moduleCount} modules, avg fanOut ${avgFanOut.toFixed(1)}, max ${fanOutMax}, ${input.cycleCount} cycle${input.cycleCount === 1 ? '' : 's'})`;

  // ── Cohesion ──────────────────────────────────────────────────────────
  const cohesionWeighted = input.cohesionWeighted ?? 0;
  const moduleLocSum = input.moduleLocSum ?? 0;
  const cohesionScore = moduleLocSum > 0 ? clamp((cohesionWeighted / moduleLocSum) * 100) : 100;
  if (moduleLocSum === 0) {
    notes.cohesion = 'limited signal — no module-internal imports detected';
    derivation.cohesion = 'no module with internal/external edge signal — defaulted to 100';
  } else {
    derivation.cohesion =
      `LOC-weighted average of per-module cohesion ratios × 100 = ${cohesionScore.toFixed(0)} ` +
      `(${moduleLocSum.toLocaleString()} LOC across modules with signal)`;
  }

  // ── Smells ────────────────────────────────────────────────────────────
  // Per-severity rate (count per KLOC) × per-severity penalty weight, summed.
  // Each severity contributes independently so a repo with only minors doesn't
  // floor at 0, and one critical produces a visible-but-not-fatal hit.
  const counts: Record<Severity, number> = { critical: 0, major: 0, minor: 0, info: 0 };
  for (const s of input.smells) counts[s.severity] += 1;
  const effectiveLoc = Math.max(input.totalLoc, MIN_RATE_LOC);
  let smellsPenalty = 0;
  for (const sev of Object.keys(counts) as Severity[]) {
    const rate = (counts[sev] * 1000) / effectiveLoc;
    smellsPenalty += rate * SEVERITY_PENALTY_PER_KLOC[sev];
  }
  const smellsScore = clamp(100 - smellsPenalty);
  derivation.smells =
    `100 − Σ severity-weighted rate per KLOC = ${smellsScore.toFixed(0)} ` +
    `(${counts.critical} critical, ${counts.major} major, ${counts.minor} minor, ${counts.info} info across ${input.totalLoc.toLocaleString()} LOC)`;

  // ── Overall ───────────────────────────────────────────────────────────
  // Any dimension that carries a measurementNote (off / limited signal /
  // approximate) is excluded from the overall and remaining weights are
  // renormalised. This stops "100 because we didn't measure it" from
  // inflating the headline score on small or single-module repos.
  const components: Array<[Dimension, number, number]> = [
    ['complexity', complexityScore, merged.complexity],
    ['duplication', duplicationScore, merged.duplication],
    ['coupling', couplingScore, merged.coupling],
    ['cohesion', cohesionScore, merged.cohesion],
    ['smells', smellsScore, merged.smells],
  ];
  const activeComponents = components.filter(([dim]) => notes[dim] === undefined);
  const activeWeightSum = activeComponents.reduce((sum, [, , w]) => sum + w, 0);
  const overall =
    activeWeightSum > 0
      ? clamp(
          activeComponents.reduce((sum, [, score, weight]) => sum + score * weight, 0) /
            activeWeightSum
        )
      : 0;

  const breakdown: ScoreBreakdown = {
    complexity: round(complexityScore),
    duplication: round(duplicationScore),
    coupling: round(couplingScore),
    cohesion: round(cohesionScore),
    smells: round(smellsScore),
    overall: round(overall),
  };
  if (Object.keys(notes).length > 0) breakdown.measurementNotes = notes;
  if (Object.keys(derivation).length > 0) breakdown.derivation = derivation;
  return breakdown;
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
