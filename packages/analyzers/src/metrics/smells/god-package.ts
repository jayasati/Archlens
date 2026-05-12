import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('god-package');

export interface GodPackageInput {
  moduleId: string;
  moduleName: string;
  fileCount: number;
  loc: number;
  anchorFile: string;
}

export interface GodPackageThresholds {
  files: number;
  loc: number;
}

let counter = 0;

export function detectGodPackage(
  mod: GodPackageInput,
  thresholds: GodPackageThresholds
): Smell | null {
  const tooManyFiles = mod.fileCount >= thresholds.files;
  const tooBig = mod.loc >= thresholds.loc;
  if (!tooManyFiles && !tooBig) return null;

  const reasons: string[] = [];
  if (tooManyFiles) reasons.push(`${mod.fileCount} files (>= ${thresholds.files})`);
  if (tooBig) reasons.push(`${mod.loc} LOC (>= ${thresholds.loc})`);
  const severity: Smell['severity'] =
    mod.fileCount >= thresholds.files * 2 || mod.loc >= thresholds.loc * 2 ? 'major' : 'minor';

  return {
    id: `smell_god_package_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity,
    message: `Module ${mod.moduleName} is oversized: ${reasons.join(', ')}`,
    file: mod.anchorFile,
  };
}
