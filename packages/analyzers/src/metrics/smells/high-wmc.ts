import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('high-wmc');

export interface HighWmcInput {
  filePath: string;
  name: string;
  startLine: number;
  endLine: number;
  methodComplexities: number[];
}

export interface HighWmcThresholds {
  wmc: number;
}

let counter = 0;

export function detectHighWmc(cls: HighWmcInput, thresholds: HighWmcThresholds): Smell | null {
  const wmc = cls.methodComplexities.reduce((a, b) => a + b, 0);
  if (wmc < thresholds.wmc) return null;

  const severity: Smell['severity'] = wmc >= thresholds.wmc * 2 ? 'major' : 'minor';
  return {
    id: `smell_high_wmc_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity,
    message: `Class ${cls.name} has WMC ${wmc} across ${cls.methodComplexities.length} methods (>= ${thresholds.wmc})`,
    file: cls.filePath,
    location: { startLine: cls.startLine, endLine: cls.endLine },
  };
}
