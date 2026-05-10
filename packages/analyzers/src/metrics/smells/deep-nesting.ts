import type { Smell } from '../../ir/types.js';

export interface DeepNestingInput {
  filePath: string;
  className?: string;
  name: string;
  startLine: number;
  endLine: number;
  maxNestingDepth: number;
}

export interface DeepNestingThresholds {
  depth: number;
}

let counter = 0;

export function detectDeepNesting(
  fn: DeepNestingInput,
  thresholds: DeepNestingThresholds
): Smell | null {
  if (fn.maxNestingDepth < thresholds.depth) return null;

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  const severity: Smell['severity'] =
    fn.maxNestingDepth >= thresholds.depth + 2 ? 'major' : 'minor';
  return {
    id: `smell_deep_nesting_${++counter}`,
    kind: 'deep-nesting',
    ruleId: 'deep-nesting',
    severity,
    message: `Method ${owner} has nesting depth ${fn.maxNestingDepth} (>= ${thresholds.depth})`,
    file: fn.filePath,
    location: { startLine: fn.startLine, endLine: fn.endLine },
  };
}
