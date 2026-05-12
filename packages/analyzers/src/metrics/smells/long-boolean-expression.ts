import type Parser from 'web-tree-sitter';
import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

const RULE = smellRule('long-boolean-expression');

export interface LongBooleanInput {
  filePath: string;
  className?: string;
  name: string;
  startLine: number;
  endLine: number;
  bodyNode: Parser.SyntaxNode | null;
}

export interface LongBooleanThresholds {
  operators: number;
}

let counter = 0;

export function detectLongBooleanExpression(
  fn: LongBooleanInput,
  thresholds: LongBooleanThresholds
): Smell | null {
  if (!fn.bodyNode) return null;

  let worst = 0;
  let worstLine = fn.startLine;
  walkTopExpressions(fn.bodyNode, (expr) => {
    const ops = countBooleanOperators(expr);
    if (ops > worst) {
      worst = ops;
      worstLine = expr.startPosition.row + 1;
    }
  });

  if (worst < thresholds.operators) return null;

  const owner = fn.className ? `${fn.className}.${fn.name}` : fn.name;
  return {
    id: `smell_long_bool_${++counter}`,
    kind: RULE.kind,
    ruleId: RULE.ruleId,
    severity: worst >= thresholds.operators * 2 ? 'major' : 'minor',
    message: `Function ${owner} has a boolean expression with ${worst} operators (>= ${thresholds.operators})`,
    file: fn.filePath,
    location: { startLine: worstLine, endLine: worstLine },
  };
}

// Yields the "interesting" top-level expressions: conditions of if/while,
// the value of assert, return values, and assignment right-hand sides.
function walkTopExpressions(node: Parser.SyntaxNode, visit: (n: Parser.SyntaxNode) => void): void {
  if (
    node.type === 'if_statement' ||
    node.type === 'while_statement' ||
    node.type === 'elif_clause'
  ) {
    const cond = node.childForFieldName('condition');
    if (cond) visit(cond);
  } else if (node.type === 'assert_statement') {
    for (const c of node.namedChildren) visit(c);
  } else if (node.type === 'return_statement') {
    for (const c of node.namedChildren) visit(c);
  }
  for (const child of node.namedChildren) walkTopExpressions(child, visit);
}

function countBooleanOperators(node: Parser.SyntaxNode): number {
  let n = 0;
  const walk = (cur: Parser.SyntaxNode): void => {
    if (cur.type === 'boolean_operator') n += 1;
    for (const child of cur.namedChildren) walk(child);
  };
  walk(node);
  return n;
}
