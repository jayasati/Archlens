import type Parser from 'web-tree-sitter';

export interface ComplexityConfig {
  /** Node types that add a branch (cyclomatic + 1 each). */
  decisionNodes: Set<string>;
  /** Node types that introduce a new nesting level. */
  nestingNodes: Set<string>;
  /** Optional predicate for logical AND / OR / nullish-coalescing operators. */
  isBooleanOperator?: (node: Parser.SyntaxNode) => boolean;
  /** Comprehension/generator node types that may carry inline `if` clauses. */
  comprehensionNodes?: Set<string>;
}

export const PYTHON_COMPLEXITY: ComplexityConfig = {
  decisionNodes: new Set([
    'if_statement',
    'elif_clause',
    'while_statement',
    'for_statement',
    'except_clause',
    'conditional_expression',
    'assert_statement',
    'case_clause',
    'match_statement',
  ]),
  nestingNodes: new Set([
    'if_statement',
    'elif_clause',
    'else_clause',
    'while_statement',
    'for_statement',
    'try_statement',
    'with_statement',
    'match_statement',
  ]),
  isBooleanOperator: (node) => node.type === 'boolean_operator',
  comprehensionNodes: new Set([
    'list_comprehension',
    'set_comprehension',
    'dictionary_comprehension',
    'generator_expression',
  ]),
};

export const NODE_COMPLEXITY: ComplexityConfig = {
  decisionNodes: new Set([
    'if_statement',
    'while_statement',
    'do_statement',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'catch_clause',
    'ternary_expression',
    'switch_case',
  ]),
  nestingNodes: new Set([
    'if_statement',
    'else_clause',
    'while_statement',
    'do_statement',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'try_statement',
    'catch_clause',
    'switch_statement',
  ]),
  isBooleanOperator: (node) => {
    if (node.type !== 'binary_expression') return false;
    const op = node.childForFieldName('operator');
    if (!op) return false;
    return op.text === '&&' || op.text === '||' || op.text === '??';
  },
};

export interface FunctionComplexity {
  cyclomatic: number;
  cognitive: number;
  maxNestingDepth: number;
}

export function computeComplexity(
  body: Parser.SyntaxNode | null,
  config: ComplexityConfig = PYTHON_COMPLEXITY
): FunctionComplexity {
  if (!body) return { cyclomatic: 1, cognitive: 0, maxNestingDepth: 0 };

  let cyclomatic = 1;
  let cognitive = 0;
  let maxDepth = 0;

  const walk = (node: Parser.SyntaxNode, depth: number, nestingForCognitive: number): void => {
    const type = node.type;

    if (config.decisionNodes.has(type)) {
      cyclomatic += 1;
      cognitive += 1 + nestingForCognitive;
    } else if (config.isBooleanOperator?.(node)) {
      cyclomatic += 1;
      cognitive += 1;
    } else if (config.comprehensionNodes?.has(type)) {
      for (const child of node.namedChildren) {
        if (child.type === 'if_clause') {
          cyclomatic += 1;
          cognitive += 1 + nestingForCognitive;
        }
      }
    }

    let nextDepth = depth;
    let nextCognitive = nestingForCognitive;
    if (config.nestingNodes.has(type)) {
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
