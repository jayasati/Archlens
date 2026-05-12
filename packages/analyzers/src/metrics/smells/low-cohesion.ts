import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('low-cohesion');

export interface LowCohesionInput {
  moduleId: string;
  moduleName: string;
  cohesionRatio: number;
  fileCount: number;
  // First file in the module — used as the report anchor since smells must
  // attach to a file path. Module-level findings still show up in the smells
  // list and in the module view.
  anchorFile: string;
}

export interface LowCohesionThresholds {
  ratio: number;
}

let counter = 0;

export function detectLowCohesion(
  mod: LowCohesionInput,
  thresholds: LowCohesionThresholds
): Smell | null {
  // A single-file module has cohesion 0 trivially — no internal edges to make.
  // Skip those: the finding would be noise.
  if (mod.fileCount < 2) return null;
  if (mod.cohesionRatio >= thresholds.ratio) return null;

  const severity: Smell['severity'] = mod.cohesionRatio < thresholds.ratio / 2 ? 'major' : 'minor';
  const pct = (mod.cohesionRatio * 100).toFixed(0);
  return {
    id: `smell_low_cohesion_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity,
    message: `Module ${mod.moduleName} has low cohesion: ${pct}% of edges stay inside (< ${thresholds.ratio * 100}%)`,
    file: mod.anchorFile,
  };
}
