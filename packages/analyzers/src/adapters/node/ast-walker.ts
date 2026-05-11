import type Parser from 'web-tree-sitter';
import { getNodeParser, languageForExtension, type NodeLanguage } from './parser.js';

export interface ParsedImport {
  /** The raw module specifier as written, e.g. "./foo", "@app/users", "express". */
  source: string;
  /** True for `import type ...` and `import { type Foo }` — kept for future filtering. */
  isTypeOnly: boolean;
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
  decorators: string[];
}

export interface ParsedClass {
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  decorators: string[];
  superclass: string | null;
  implementsList: string[];
  methods: ParsedFunction[];
  attributes: string[];
}

export interface ParsedFile {
  relPath: string;
  source: string;
  language: NodeLanguage;
  loc: number;
  imports: ParsedImport[];
  classes: ParsedClass[];
  functions: ParsedFunction[];
  tree: Parser.Tree;
}

export async function parseNodeSource(
  relPath: string,
  source: string,
  language: NodeLanguage
): Promise<ParsedFile> {
  const parser = await getNodeParser(language);
  const tree = parser.parse(source);
  const root = tree.rootNode;

  const imports: ParsedImport[] = [];
  const classes: ParsedClass[] = [];
  const functions: ParsedFunction[] = [];

  for (const child of root.namedChildren) {
    visitTopLevel(child, imports, classes, functions, []);
  }

  return {
    relPath,
    source,
    language,
    loc: countLoc(source),
    imports,
    classes,
    functions,
    tree,
  };
}

export async function parseNodeFileByPath(
  relPath: string,
  source: string
): Promise<ParsedFile | null> {
  const ext = extOf(relPath);
  const language = languageForExtension(ext);
  if (!language) return null;
  return parseNodeSource(relPath, source, language);
}

function visitTopLevel(
  node: Parser.SyntaxNode,
  imports: ParsedImport[],
  classes: ParsedClass[],
  functions: ParsedFunction[],
  externalDecorators: string[]
): void {
  const type = node.type;

  if (type === 'import_statement') {
    const imp = parseImport(node);
    if (imp) imports.push(imp);
    return;
  }

  if (type === 'export_statement') {
    // Re-export forms like `export { foo } from 'bar';` carry a string source.
    // Treat those as imports too so the dependency graph picks them up.
    let reexportSource: string | null = null;
    const collected: string[] = [];
    for (const child of node.namedChildren) {
      if (child.type === 'decorator') {
        const name = decoratorName(child);
        if (name) collected.push(name);
      } else if (child.type === 'string') {
        reexportSource = stringLiteralValue(child);
      }
    }
    if (reexportSource) {
      imports.push({
        source: reexportSource,
        isTypeOnly: false,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      });
    }
    for (const child of node.namedChildren) {
      if (child.type === 'decorator' || child.type === 'string') continue;
      visitTopLevel(child, imports, classes, functions, collected);
    }
    return;
  }

  if (type === 'class_declaration' || type === 'abstract_class_declaration') {
    classes.push(parseClass(node, externalDecorators));
    return;
  }

  if (type === 'function_declaration' || type === 'generator_function_declaration') {
    functions.push(parseFunction(node, externalDecorators));
    return;
  }
}

function parseImport(node: Parser.SyntaxNode): ParsedImport | null {
  // import_statement → "import" [import_clause] "from" string ;  OR  "import" string ;
  let source: string | null = null;
  let isTypeOnly = false;

  // Walk children for the string literal source.
  for (const child of node.namedChildren) {
    if (child.type === 'string') {
      source = stringLiteralValue(child);
    }
    if (child.type === 'import_clause') {
      // Detect `import type ...` by inspecting unnamed children for the 'type' keyword.
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (c && c.type === 'type' && c.startIndex < child.startIndex) {
          isTypeOnly = true;
        }
      }
    }
  }

  if (!source) return null;
  return {
    source,
    isTypeOnly,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  };
}

function stringLiteralValue(node: Parser.SyntaxNode): string {
  // tree-sitter wraps the literal text in `string_fragment` named children
  for (const child of node.namedChildren) {
    if (child.type === 'string_fragment') return child.text;
  }
  // fallback: strip surrounding quotes
  const t = node.text;
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseClass(node: Parser.SyntaxNode, externalDecorators: string[] = []): ParsedClass {
  const nameNode = node.childForFieldName('name');
  const bodyNode = node.childForFieldName('body');
  const heritage = findChild(node, ['class_heritage']);
  const ownDecorators = collectDecorators(node);
  const decorators =
    externalDecorators.length > 0 ? [...externalDecorators, ...ownDecorators] : ownDecorators;

  let superclass: string | null = null;
  const implementsList: string[] = [];
  if (heritage) {
    for (const clause of heritage.namedChildren) {
      if (clause.type === 'extends_clause') {
        const id = firstIdentifierLike(clause);
        if (id) superclass = id;
      } else if (clause.type === 'implements_clause') {
        for (const t of clause.namedChildren) {
          const id = firstIdentifierLike(t) ?? t.text;
          if (id) implementsList.push(id);
        }
      }
    }
  }

  const methods: ParsedFunction[] = [];
  const attributes: string[] = [];
  if (bodyNode) {
    for (const member of bodyNode.namedChildren) {
      if (member.type === 'method_definition') {
        const methodDecorators = collectDecorators(member);
        methods.push(parseFunction(member, methodDecorators));
      } else if (
        member.type === 'public_field_definition' ||
        member.type === 'property_signature'
      ) {
        const propName = member.childForFieldName('name');
        if (propName) attributes.push(propName.text);
      }
    }
  }

  return {
    name: nameNode ? nameNode.text : '<anonymous>',
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    loc: countLoc(node.text),
    decorators,
    superclass,
    implementsList,
    methods,
    attributes,
  };
}

function parseFunction(node: Parser.SyntaxNode, decorators: string[]): ParsedFunction {
  const nameNode = node.childForFieldName('name');
  const paramsNode = node.childForFieldName('parameters');
  const bodyNode = node.childForFieldName('body');

  const paramCount = paramsNode ? paramsNode.namedChildren.length : 0;
  const sigParams = paramsNode ? paramsNode.text.replace(/^\(|\)$/g, '') : '';
  const name = nameNode ? nameNode.text : '<anonymous>';
  return {
    name,
    signature: `${name}(${sigParams})`,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    loc: countLoc(node.text),
    bodyNode,
    paramCount,
    decorators,
  };
}

/**
 * Collect decorator names attached to the given node. Returns the bare
 * identifier (`Controller` for both `@Controller` and `@Controller('users')`,
 * `Foo` for `@foo.Bar` we keep the trailing `Bar` only).
 */
function collectDecorators(node: Parser.SyntaxNode): string[] {
  const out: string[] = [];
  for (const child of node.namedChildren) {
    if (child.type !== 'decorator') continue;
    const name = decoratorName(child);
    if (name) out.push(name);
  }
  return out;
}

function decoratorName(decorator: Parser.SyntaxNode): string | null {
  // decorator → @ <expression>
  // expression may be: identifier, call_expression, member_expression
  for (const child of decorator.namedChildren) {
    if (child.type === 'identifier') return child.text;
    if (child.type === 'call_expression') {
      const fn = child.childForFieldName('function');
      if (!fn) return null;
      if (fn.type === 'identifier') return fn.text;
      if (fn.type === 'member_expression') {
        const property = fn.childForFieldName('property');
        return property ? property.text : null;
      }
      return fn.text;
    }
    if (child.type === 'member_expression') {
      const property = child.childForFieldName('property');
      return property ? property.text : null;
    }
  }
  return null;
}

function firstIdentifierLike(node: Parser.SyntaxNode): string | null {
  for (const child of node.namedChildren) {
    if (
      child.type === 'identifier' ||
      child.type === 'type_identifier' ||
      child.type === 'nested_type_identifier'
    ) {
      return child.text;
    }
    const inner = firstIdentifierLike(child);
    if (inner) return inner;
  }
  return null;
}

function findChild(node: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode | null {
  for (const child of node.namedChildren) {
    if (types.includes(child.type)) return child;
  }
  return null;
}

function extOf(relPath: string): string {
  const idx = relPath.lastIndexOf('.');
  return idx >= 0 ? relPath.slice(idx) : '';
}

export function countLoc(source: string): number {
  let count = 0;
  let inBlock = false;
  for (const raw of source.split(/\r?\n/)) {
    let line = raw.trim();
    if (line.length === 0) continue;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end >= 0) {
        inBlock = false;
        line = line.slice(end + 2).trim();
        if (line.length === 0) continue;
      } else {
        continue;
      }
    }
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      const end = line.indexOf('*/', 2);
      if (end < 0) {
        inBlock = true;
        continue;
      }
      line = line.slice(end + 2).trim();
      if (line.length === 0) continue;
    }
    count++;
  }
  return count;
}
