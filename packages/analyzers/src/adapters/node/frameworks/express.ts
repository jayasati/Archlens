import type { ParsedFile } from '../ast-walker.js';

export interface ExpressRoute {
  method: string;
  path: string;
  file: string;
  line: number;
}

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'all',
  'use',
]);

/** True when the file imports `express` (default or named). */
export function fileLooksLikeExpress(file: ParsedFile): boolean {
  return file.imports.some((imp) => imp.source === 'express' || imp.source.startsWith('express/'));
}

/**
 * Stub route extractor. Walks the AST for `<obj>.<method>('/path', ...)` calls
 * and reports the first string-literal arg as the path. Misses dynamic routes
 * and chained `app.route('/x').get(...)`. Good enough for layer tagging in v1.
 */
export function extractExpressRoutes(file: ParsedFile): ExpressRoute[] {
  const routes: ExpressRoute[] = [];
  const root = file.tree.rootNode;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'call_expression') {
      const fn = node.childForFieldName('function');
      if (fn && fn.type === 'member_expression') {
        const property = fn.childForFieldName('property');
        const method = property?.text?.toLowerCase();
        if (method && HTTP_METHODS.has(method)) {
          const args = node.childForFieldName('arguments');
          const firstArg = args?.namedChildren[0];
          if (firstArg && firstArg.type === 'string') {
            const literal = stringLiteralValue(firstArg);
            if (literal !== null) {
              routes.push({
                method: method.toUpperCase(),
                path: literal,
                file: file.relPath,
                line: node.startPosition.row + 1,
              });
            }
          }
        }
      }
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) stack.push(child);
    }
  }
  return routes;
}

function stringLiteralValue(node: import('web-tree-sitter').SyntaxNode): string | null {
  for (const child of node.namedChildren) {
    if (child.type === 'string_fragment') return child.text;
  }
  const t = node.text;
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return null;
}
