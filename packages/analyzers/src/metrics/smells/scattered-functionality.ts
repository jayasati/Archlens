import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('scattered-functionality');

export interface ScatteredFunctionalityInput {
  moduleId: string;
  moduleName: string;
  fanOut: number;
  anchorFile: string;
}

export interface ScatteredFunctionalityThresholds {
  fanOut: number;
}

let counter = 0;

export function detectScatteredFunctionality(
  mod: ScatteredFunctionalityInput,
  thresholds: ScatteredFunctionalityThresholds
): Smell | null {
  if (mod.fanOut < thresholds.fanOut) return null;
  return {
    id: `smell_scattered_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: mod.fanOut >= thresholds.fanOut * 2 ? 'major' : 'minor',
    message: `Module ${mod.moduleName} depends on ${mod.fanOut} other modules (>= ${thresholds.fanOut})`,
    file: mod.anchorFile,
  };
}
