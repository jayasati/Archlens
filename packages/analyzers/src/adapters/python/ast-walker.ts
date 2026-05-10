import type Parser from 'web-tree-sitter';
import { getPythonParser } from './parser.js';

export interface ParsedImport {
  module: string;
  names: string[];
  isRelative: boolean;
  level: number;
  startLine: number;
  endLine: number;
}

export interface ParsedFunction {
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  loc: number;
  bodyNode: Parser.SyntaxNode | null;
  paramCount: number;
}

export interface ParsedClass {
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  bases: string[];
  methods: ParsedFunction[];
  attributes: string[];
}

export interface ParsedFile {
  relPath: string;
  source: string;
  loc: number;
  imports: ParsedImport[];
  classes: ParsedClass[];
  functions: ParsedFunction[];
  tree: Parser.Tree;
}

export async function parsePythonSource(relPath: string, source: string): Promise<ParsedFile> {
  const parser = await getPythonParser();
  const tree = parser.parse(source);
  const root = tree.rootNode;

  const imports: ParsedImport[] = [];
  const classes: ParsedClass[] = [];
  const functions: ParsedFunction[] = [];

  for (const child of root.namedChildren) {
    if (child.type === 'import_statement' || child.type === 'import_from_statement') {
      imports.push(...parseImport(child));
    } else if (child.type === 'class_definition') {
      classes.push(parseClass(child));
    } else if (child.type === 'function_definition' || child.type === 'decorated_definition') {
      const fn = parseTopLevelFunction(child);
      if (fn) functions.push(fn);
    }
  }

  return {
    relPath,
    source,
    loc: countLoc(source),
    imports,
    classes,
    functions,
    tree,
  };
}

function parseImport(node: Parser.SyntaxNode): ParsedImport[] {
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;

  if (node.type === 'import_statement') {
    const out: ParsedImport[] = [];
    for (const child of node.namedChildren) {
      if (child.type === 'dotted_name' || child.type === 'aliased_import') {
        const dotted = child.type === 'aliased_import' ? child.childForFieldName('name') : child;
        if (dotted) {
          out.push({
            module: dotted.text,
            names: [],
            isRelative: false,
            level: 0,
            startLine,
            endLine,
          });
        }
      }
    }
    return out;
  }

  // import_from_statement: from <module> import <names>
  const moduleNode =
    node.childForFieldName('module_name') ?? findChild(node, ['dotted_name', 'relative_import']);
  let modText = '';
  let level = 0;
  let isRelative = false;
  if (moduleNode) {
    if (moduleNode.type === 'relative_import') {
      isRelative = true;
      const dots = findChild(moduleNode, ['import_prefix']);
      level = dots ? dots.text.length : 0;
      const inner = findChild(moduleNode, ['dotted_name']);
      modText = inner ? inner.text : '';
    } else {
      modText = moduleNode.text;
    }
  }

  const names: string[] = [];
  for (const child of node.namedChildren) {
    if (child === moduleNode) continue;
    if (child.type === 'dotted_name') {
      names.push(child.text);
    } else if (child.type === 'aliased_import') {
      const nm = child.childForFieldName('name');
      if (nm) names.push(nm.text);
    } else if (child.type === 'wildcard_import') {
      names.push('*');
    }
  }

  return [
    {
      module: modText,
      names,
      isRelative,
      level,
      startLine,
      endLine,
    },
  ];
}

function parseClass(node: Parser.SyntaxNode): ParsedClass {
  const nameNode = node.childForFieldName('name');
  const bodyNode = node.childForFieldName('body');
  const supers = node.childForFieldName('superclasses');

  const bases: string[] = [];
  if (supers) {
    for (const arg of supers.namedChildren) {
      if (arg.type === 'identifier' || arg.type === 'attribute' || arg.type === 'dotted_name') {
        bases.push(arg.text);
      }
    }
  }

  const methods: ParsedFunction[] = [];
  const attributes: string[] = [];
  if (bodyNode) {
    for (const child of bodyNode.namedChildren) {
      if (child.type === 'function_definition') {
        methods.push(parseFunction(child));
      } else if (child.type === 'decorated_definition') {
        const fn = findChild(child, ['function_definition']);
        if (fn) methods.push(parseFunction(fn));
      } else if (child.type === 'expression_statement') {
        const inner = child.namedChildren[0];
        if (inner && inner.type === 'assignment') {
          const left = inner.childForFieldName('left');
          if (left && left.type === 'identifier') attributes.push(left.text);
        }
      }
    }
  }

  return {
    name: nameNode ? nameNode.text : '<anonymous>',
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    loc: countLoc(node.text),
    bases,
    methods,
    attributes,
  };
}

function parseTopLevelFunction(node: Parser.SyntaxNode): ParsedFunction | null {
  if (node.type === 'function_definition') return parseFunction(node);
  if (node.type === 'decorated_definition') {
    const fn = findChild(node, ['function_definition']);
    return fn ? parseFunction(fn) : null;
  }
  return null;
}

function parseFunction(node: Parser.SyntaxNode): ParsedFunction {
  const nameNode = node.childForFieldName('name');
  const paramsNode = node.childForFieldName('parameters');
  const bodyNode = node.childForFieldName('body');

  const paramCount = paramsNode ? paramsNode.namedChildren.length : 0;
  const signature = `${nameNode ? nameNode.text : '<anonymous>'}(${
    paramsNode ? paramsNode.text.replace(/^\(|\)$/g, '') : ''
  })`;

  return {
    name: nameNode ? nameNode.text : '<anonymous>',
    signature,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    loc: countLoc(node.text),
    bodyNode,
    paramCount,
  };
}

function findChild(node: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode | null {
  for (const child of node.namedChildren) {
    if (types.includes(child.type)) return child;
  }
  return null;
}

export function countLoc(source: string): number {
  let count = 0;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith('#')) continue;
    count++;
  }
  return count;
}
