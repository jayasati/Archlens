import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('god-function');

export interface GodFunctionInput {
  filePath: string;
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  complexity: number;
}

export interface GodFunctionThresholds {
  loc: number;
  complexity: number;
}

let counter = 0;

export function detectGodFunction(
  fn: GodFunctionInput,
  thresholds: GodFunctionThresholds
): Smell | null {
  // Only flag when *both* dimensions exceed the threshold — that's what
  // distinguishes a "god function" from a merely long or merely complex one.
  if (fn.loc < thresholds.loc) return null;
  if (fn.complexity < thresholds.complexity) return null;

  const severity: Smell['severity'] =
    fn.loc >= thresholds.loc * 2 && fn.complexity >= thresholds.complexity * 2
      ? 'critical'
      : 'major';
  return {
    id: `smell_god_function_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity,
    message: `Top-level function ${fn.name} is long and complex: ${fn.loc} LOC, cyclomatic ${fn.complexity}`,
    file: fn.filePath,
    location: { startLine: fn.startLine, endLine: fn.endLine },
  };
}
