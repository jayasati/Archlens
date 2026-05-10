import type { Smell } from '../../ir/types.js';

export interface GodClassInput {
  filePath: string;
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  methodCount: number;
  attributeCount: number;
}

export interface GodClassThresholds {
  methods: number;
  loc: number;
}

let counter = 0;

export function detectGodClass(cls: GodClassInput, thresholds: GodClassThresholds): Smell | null {
  const tooManyMethods = cls.methodCount >= thresholds.methods;
  const tooBig = cls.loc >= thresholds.loc;
  if (!tooManyMethods && !tooBig) return null;

  const reasons: string[] = [];
  if (tooManyMethods) reasons.push(`${cls.methodCount} methods (>= ${thresholds.methods})`);
  if (tooBig) reasons.push(`${cls.loc} LOC (>= ${thresholds.loc})`);

  const severity: Smell['severity'] =
    cls.methodCount >= thresholds.methods * 2 || cls.loc >= thresholds.loc * 2 ? 'major' : 'minor';

  return {
    id: `smell_god_class_${++counter}`,
    kind: 'god-class',
    ruleId: 'god-class',
    severity,
    message: `Class ${cls.name} looks like a god class: ${reasons.join(', ')}`,
    file: cls.filePath,
    location: { startLine: cls.startLine, endLine: cls.endLine },
  };
}
