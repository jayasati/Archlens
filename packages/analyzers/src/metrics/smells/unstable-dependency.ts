import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('unstable-dependency');

export interface UnstableDependencyInput {
  moduleId: string;
  moduleName: string;
  fanIn: number;
  fanOut: number;
  instability: number;
  anchorFile: string;
}

export interface UnstableDependencyThresholds {
  instability: number;
  // Reuse hubFanIn — a module isn't really an unstable dependency unless it
  // is also being depended on.
  hubFanIn: number;
}

let counter = 0;

export function detectUnstableDependency(
  mod: UnstableDependencyInput,
  thresholds: UnstableDependencyThresholds
): Smell | null {
  if (mod.instability < thresholds.instability) return null;
  if (mod.fanIn < thresholds.hubFanIn) return null;

  const pct = (mod.instability * 100).toFixed(0);
  return {
    id: `smell_unstable_dep_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: 'minor',
    message: `Module ${mod.moduleName} is unstable (I=${pct}%) yet ${mod.fanIn} modules depend on it`,
    file: mod.anchorFile,
  };
}
