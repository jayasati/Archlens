import type Parser from 'web-tree-sitter';
import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('empty-catch');

export interface EmptyCatchInput {
  filePath: string;
  className?: string;
  name: string;
  bodyNode: Parser.SyntaxNode | null;
}

let counter = 0;

export function detectEmptyCatch(fn: EmptyCatchInput): Smell[] {
  if (!fn.bodyNode) return [];
  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  const found: Smell[] = [];

  walk(fn.bodyNode, (node) => {
    if (node.type !== 'except_clause') return;
    if (!isTriviallyEmpty(node)) return;
    found.push({
      id: `smell_empty_catch_${++counter}`,
      kind: RULE.kind,
      ruleId: RULE.ruleId,
      severity: 'major',
      message: `Empty except clause in ${owner} silently swallows the exception`,
      file: fn.filePath,
      location: {
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      },
    });
  });

  return found;
}

function isTriviallyEmpty(exceptClause: Parser.SyntaxNode): boolean {
  // tree-sitter-python represents the body as a `block` of statements. We
  // consider it empty when the only statements are `pass` or a bare ellipsis.
  let block: Parser.SyntaxNode | null = null;
  for (const child of exceptClause.namedChildren) {
    if (child.type === 'block') {
      block = child;
      break;
    }
  }
  if (!block) return false;

  for (const stmt of block.namedChildren) {
    if (stmt.type === 'pass_statement') continue;
    if (
      stmt.type === 'expression_statement' &&
      stmt.namedChildren.length === 1 &&
      stmt.namedChildren[0]!.type === 'ellipsis'
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function walk(node: Parser.SyntaxNode, visit: (n: Parser.SyntaxNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
