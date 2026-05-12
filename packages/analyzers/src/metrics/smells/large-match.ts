import type Parser from 'web-tree-sitter';
import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('large-match');

export interface LargeMatchInput {
  filePath: string;
  className?: string;
  name: string;
  bodyNode: Parser.SyntaxNode | null;
}

export interface LargeMatchThresholds {
  cases: number;
}

let counter = 0;

export function detectLargeMatch(fn: LargeMatchInput, thresholds: LargeMatchThresholds): Smell[] {
  if (!fn.bodyNode) return [];

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  const found: Smell[] = [];

  walk(fn.bodyNode, (node) => {
    if (node.type === 'match_statement') {
      let cases = 0;
      for (const child of node.namedChildren) {
        if (child.type === 'case_clause' || child.type === 'block') {
          // tree-sitter-python nests case_clauses inside a `block` of the
          // match_statement. Count both depths to be safe.
          if (child.type === 'case_clause') cases += 1;
          else
            for (const inner of child.namedChildren) if (inner.type === 'case_clause') cases += 1;
        }
      }
      pushIfTooLarge(found, fn.filePath, owner, node, cases, thresholds);
    } else if (node.type === 'if_statement') {
      // Only count the topmost if/elif chain; nested ifs are evaluated on
      // their own recursion.
      if (node.parent && node.parent.type === 'elif_clause') return;
      const cases = 1 + countElifs(node);
      pushIfTooLarge(found, fn.filePath, owner, node, cases, thresholds);
    }
  });

  return found;
}

function pushIfTooLarge(
  out: Smell[],
  filePath: string,
  owner: string,
  node: Parser.SyntaxNode,
  cases: number,
  thresholds: LargeMatchThresholds
): void {
  if (cases < thresholds.cases) return;
  out.push({
    id: `smell_large_match_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: cases >= thresholds.cases * 2 ? 'major' : 'minor',
    message: `Function ${owner} has ${cases}-way branch (>= ${thresholds.cases}) at line ${node.startPosition.row + 1}`,
    file: filePath,
    location: {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    },
  });
}

function countElifs(ifNode: Parser.SyntaxNode): number {
  let n = 0;
  for (const child of ifNode.namedChildren) {
    if (child.type === 'elif_clause') n += 1;
  }
  return n;
}

function walk(node: Parser.SyntaxNode, visit: (n: Parser.SyntaxNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
