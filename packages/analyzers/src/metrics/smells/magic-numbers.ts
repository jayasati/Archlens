import type Parser from 'web-tree-sitter';
import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('magic-numbers');

// 0, 1, -1, 2, 10, 100, 1000 are too common to be useful signal.
const WHITELIST = new Set(['0', '1', '-1', '2', '10', '100', '1000']);

export interface MagicNumbersInput {
  filePath: string;
  className?: string;
  name: string;
  startLine: number;
  endLine: number;
  bodyNode: Parser.SyntaxNode | null;
}

export interface MagicNumbersThresholds {
  min: number;
}

let counter = 0;

export function detectMagicNumbers(
  fn: MagicNumbersInput,
  thresholds: MagicNumbersThresholds
): Smell | null {
  if (!fn.bodyNode) return null;

  let count = 0;
  walk(fn.bodyNode, (node) => {
    if (node.type !== 'integer' && node.type !== 'float') return;
    if (WHITELIST.has(node.text)) return;
    // Skip literals that are default-values of parameters — those already act
    // as named constants from the caller's perspective.
    const parent = node.parent;
    if (parent && parent.type === 'default_parameter') return;
    count += 1;
  });

  if (count < thresholds.min) return null;

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  return {
    id: `smell_magic_numbers_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: count >= thresholds.min * 3 ? 'minor' : 'info',
    message: `Function ${owner} contains ${count} magic numbers (>= ${thresholds.min})`,
    file: fn.filePath,
    location: { startLine: fn.startLine, endLine: fn.endLine },
  };
}

function walk(node: Parser.SyntaxNode, visit: (n: Parser.SyntaxNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
