import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('long-parameter-list');

export interface LongParameterListInput {
  filePath: string;
  className?: string;
  name: string;
  startLine: number;
  endLine: number;
  paramCount: number;
}

export interface LongParameterListThresholds {
  count: number;
}

let counter = 0;

export function detectLongParameterList(
  fn: LongParameterListInput,
  thresholds: LongParameterListThresholds
): Smell | null {
  if (fn.paramCount < thresholds.count) return null;

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  const severity: Smell['severity'] = fn.paramCount >= thresholds.count * 2 ? 'major' : 'minor';
  return {
    id: `smell_long_params_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity,
    message: `Function ${owner} has ${fn.paramCount} parameters (>= ${thresholds.count})`,
    file: fn.filePath,
    location: { startLine: fn.startLine, endLine: fn.endLine },
  };
}
