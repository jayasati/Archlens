import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('todo-accumulation');

const MARKER = /\b(TODO|FIXME|HACK|XXX)\b/;

export interface TodoInput {
  filePath: string;
  source: string;
}

export interface TodoThresholds {
  count: number;
}

let counter = 0;

export function detectTodoAccumulation(file: TodoInput, thresholds: TodoThresholds): Smell | null {
  let count = 0;
  let firstLine = 0;
  const lines = file.source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (MARKER.test(lines[i]!)) {
      count += 1;
      if (firstLine === 0) firstLine = i + 1;
    }
  }

  if (count < thresholds.count) return null;

  return {
    id: `smell_todo_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: count >= thresholds.count * 3 ? 'minor' : 'info',
    message: `${file.filePath} accumulates ${count} TODO/FIXME/HACK markers (>= ${thresholds.count})`,
    file: file.filePath,
    location: firstLine > 0 ? { startLine: firstLine, endLine: firstLine } : undefined,
  };
}
