import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('data-class');

// Methods we don't count as "real" behaviour for the data-class check.
const TRIVIAL_METHODS = new Set([
  '__init__',
  '__repr__',
  '__str__',
  '__eq__',
  '__hash__',
  '__lt__',
  '__le__',
  '__gt__',
  '__ge__',
]);

export interface DataClassInput {
  filePath: string;
  name: string;
  startLine: number;
  endLine: number;
  attributeCount: number;
  methodNames: string[];
}

export interface DataClassThresholds {
  maxMethods: number;
}

let counter = 0;

export function detectDataClass(
  cls: DataClassInput,
  thresholds: DataClassThresholds
): Smell | null {
  if (cls.attributeCount === 0) return null;
  const nonTrivial = cls.methodNames.filter((n) => !TRIVIAL_METHODS.has(n));
  if (nonTrivial.length > thresholds.maxMethods) return null;

  return {
    id: `smell_data_class_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: 'info',
    message: `Class ${cls.name} looks like a data class: ${cls.attributeCount} attributes, ${nonTrivial.length} non-trivial methods`,
    file: cls.filePath,
    location: { startLine: cls.startLine, endLine: cls.endLine },
  };
}
