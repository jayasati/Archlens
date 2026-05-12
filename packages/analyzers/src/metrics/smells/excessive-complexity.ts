import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('excessive-complexity');

export interface ExcessiveComplexityInput {
  filePath: string;
  className?: string;
  name: string;
  startLine: number;
  endLine: number;
  complexity: number;
}

export interface ExcessiveComplexityThresholds {
  complexity: number;
}

let counter = 0;

export function detectExcessiveComplexity(
  fn: ExcessiveComplexityInput,
  thresholds: ExcessiveComplexityThresholds
): Smell | null {
  if (fn.complexity < thresholds.complexity) return null;

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  const severity: Smell['severity'] =
    fn.complexity >= thresholds.complexity * 2 ? 'critical' : 'major';
  return {
    id: `smell_excessive_complexity_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity,
    message: `Function ${owner} has cyclomatic complexity ${fn.complexity} (>= ${thresholds.complexity})`,
    file: fn.filePath,
    location: { startLine: fn.startLine, endLine: fn.endLine },
  };
}
