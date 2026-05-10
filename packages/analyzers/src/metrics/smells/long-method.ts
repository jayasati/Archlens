import type { Smell } from '../../ir/types.js';

export interface LongMethodInput {
  filePath: string;
  className?: string;
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  complexity: number;
}

export interface LongMethodThresholds {
  loc: number;
  complexity: number;
}

let counter = 0;

export function detectLongMethod(
  fn: LongMethodInput,
  thresholds: LongMethodThresholds
): Smell | null {
  const isLong = fn.loc >= thresholds.loc;
  const isComplex = fn.complexity >= thresholds.complexity;
  if (!isLong && !isComplex) return null;

  const reasons: string[] = [];
  if (isLong) reasons.push(`${fn.loc} LOC (>= ${thresholds.loc})`);
  if (isComplex) reasons.push(`cyclomatic ${fn.complexity} (>= ${thresholds.complexity})`);

  const severity: Smell['severity'] =
    fn.loc >= thresholds.loc * 2 || fn.complexity >= thresholds.complexity * 2 ? 'major' : 'minor';

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  return {
    id: `smell_long_method_${++counter}`,
    kind: 'long-method',
    ruleId: 'long-method',
    severity,
    message: `Method ${owner} is too long: ${reasons.join(', ')}`,
    file: fn.filePath,
    location: { startLine: fn.startLine, endLine: fn.endLine },
  };
}
