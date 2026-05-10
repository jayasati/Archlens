import type Parser from 'web-tree-sitter';

const DECISION_NODES = new Set<string>([
  'if_statement',
  'elif_clause',
  'while_statement',
  'for_statement',
  'except_clause',
  'conditional_expression',
  'assert_statement',
  'case_clause',
  'match_statement',
]);

const NESTING_NODES = new Set<string>([
  'if_statement',
  'elif_clause',
  'else_clause',
  'while_statement',
  'for_statement',
  'try_statement',
  'with_statement',
  'match_statement',
]);

export interface FunctionComplexity {
  cyclomatic: number;
  cognitive: number;
  maxNestingDepth: number;
}

export function computeComplexity(body: Parser.SyntaxNode | null): FunctionComplexity {
  if (!body) return { cyclomatic: 1, cognitive: 0, maxNestingDepth: 0 };

  let cyclomatic = 1;
  let cognitive = 0;
  let maxDepth = 0;

  const walk = (node: Parser.SyntaxNode, depth: number, nestingForCognitive: number): void => {
    const type = node.type;

    if (DECISION_NODES.has(type)) {
      cyclomatic += 1;
      cognitive += 1 + nestingForCognitive;
    } else if (type === 'boolean_operator') {
      cyclomatic += 1;
      cognitive += 1;
    } else if (
      type === 'list_comprehension' ||
      type === 'set_comprehension' ||
      type === 'dictionary_comprehension' ||
      type === 'generator_expression'
    ) {
      for (const child of node.namedChildren) {
        if (child.type === 'if_clause') {
          cyclomatic += 1;
          cognitive += 1 + nestingForCognitive;
        }
      }
    }

    let nextDepth = depth;
    let nextCognitive = nestingForCognitive;
    if (NESTING_NODES.has(type)) {
      nextDepth = depth + 1;
      if (nextDepth > maxDepth) maxDepth = nextDepth;
      nextCognitive = nestingForCognitive + 1;
    }

    for (const child of node.namedChildren) {
      walk(child, nextDepth, nextCognitive);
    }
  };

  walk(body, 0, 0);
  return { cyclomatic, cognitive, maxNestingDepth: maxDepth };
}
