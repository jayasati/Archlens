import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('lazy-class');

export interface LazyClassInput {
  filePath: string;
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  methodCount: number;
  attributeCount: number;
}

export interface LazyClassThresholds {
  maxLoc: number;
}

let counter = 0;

export function detectLazyClass(
  cls: LazyClassInput,
  thresholds: LazyClassThresholds
): Smell | null {
  if (cls.loc > thresholds.maxLoc) return null;
  if (cls.methodCount > 2) return null;
  // A trivial enum/marker class with attributes only is intentional.
  if (cls.methodCount === 0 && cls.attributeCount > 0) return null;

  return {
    id: `smell_lazy_class_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: 'info',
    message: `Class ${cls.name} is very small (${cls.loc} LOC, ${cls.methodCount} methods) — consider inlining`,
    file: cls.filePath,
    location: { startLine: cls.startLine, endLine: cls.endLine },
  };
}
