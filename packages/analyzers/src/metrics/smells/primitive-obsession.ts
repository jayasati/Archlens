import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('primitive-obsession');

export interface PrimitiveObsessionInput {
  filePath: string;
  className?: string;
  name: string;
  startLine: number;
  endLine: number;
  paramCount: number;
  annotatedParamCount: number;
}

export interface PrimitiveObsessionThresholds {
  params: number;
}

let counter = 0;

export function detectPrimitiveObsession(
  fn: PrimitiveObsessionInput,
  thresholds: PrimitiveObsessionThresholds
): Smell | null {
  if (fn.paramCount < thresholds.params) return null;
  // Be lenient: `self`/`cls` is always unannotated. Treat the signature as
  // "all primitives" only when no parameter carries a type annotation.
  if (fn.annotatedParamCount > 0) return null;

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  return {
    id: `smell_primitive_obsession_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: 'info',
    message: `Function ${owner} has ${fn.paramCount} untyped parameters — likely primitive obsession`,
    file: fn.filePath,
    location: { startLine: fn.startLine, endLine: fn.endLine },
  };
}
