import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('hub-dependency');

export interface HubDependencyInput {
  moduleId: string;
  moduleName: string;
  fanIn: number;
  anchorFile: string;
}

export interface HubDependencyThresholds {
  fanIn: number;
}

let counter = 0;

export function detectHubDependency(
  mod: HubDependencyInput,
  thresholds: HubDependencyThresholds
): Smell | null {
  if (mod.fanIn < thresholds.fanIn) return null;

  const severity: Smell['severity'] = mod.fanIn >= thresholds.fanIn * 2 ? 'major' : 'minor';
  return {
    id: `smell_hub_dependency_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity,
    message: `Module ${mod.moduleName} is depended on by ${mod.fanIn} modules (>= ${thresholds.fanIn})`,
    file: mod.anchorFile,
  };
}
