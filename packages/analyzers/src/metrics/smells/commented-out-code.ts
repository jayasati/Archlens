import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('commented-out-code');

// Heuristic patterns. We aim for "looks like Python code that was commented",
// not "is valid Python". False positives are OK at low severity.
const CODE_LIKE = [
  /^\s*(def|class|import|from|return|if|elif|else|for|while|with|try|except|finally|raise|yield|async|await)\b/,
  /^\s*\w+\s*=\s*[^=]/, // assignment
  /^\s*\w+\(.*\)\s*$/, // function call
  /^\s*(self|cls)\.\w+/, // attribute access
];

export interface CommentedCodeInput {
  filePath: string;
  source: string;
}

export interface CommentedCodeThresholds {
  lines: number;
}

let counter = 0;

export function detectCommentedOutCode(
  file: CommentedCodeInput,
  thresholds: CommentedCodeThresholds
): Smell | null {
  let suspicious = 0;
  let firstLine = 0;
  const lines = file.source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('#')) continue;
    // strip leading "#" then any single space
    const body = trimmed.replace(/^#+\s?/, '');
    if (body.length === 0) continue;
    if (CODE_LIKE.some((re) => re.test(body))) {
      suspicious += 1;
      if (firstLine === 0) firstLine = i + 1;
    }
  }

  if (suspicious < thresholds.lines) return null;

  return {
    id: `smell_commented_code_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: suspicious >= thresholds.lines * 3 ? 'minor' : 'info',
    message: `${file.filePath} contains ${suspicious} comment lines that look like commented-out code (>= ${thresholds.lines})`,
    file: file.filePath,
    location: firstLine > 0 ? { startLine: firstLine, endLine: firstLine } : undefined,
  };
}
