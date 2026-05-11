import type { ParsedClass, ParsedFile } from '../runners/javaparser.runner.js';
import type { SpringClassInfo, SpringLayer } from './layer-detector.js';

export interface BeanNode {
  /** Fully-qualified class name when resolvable, else simple name. */
  id: string;
  simpleName: string;
  packageName: string;
  filePath: string;
  layer: SpringLayer | null;
}

export type BeanInjectionKind = 'field' | 'constructor' | 'setter';

export interface BeanEdge {
  fromId: string;
  toId: string;
  kind: BeanInjectionKind;
  /** Type name as written at the injection point — useful for diagnostics. */
  typeName: string;
}

export interface BeanGraph {
  nodes: BeanNode[];
  edges: BeanEdge[];
  /** Map from class id to BeanNode for quick lookup. */
  byId: Map<string, BeanNode>;
  /** Map from simple class name to id (first occurrence wins). */
  bySimpleName: Map<string, string>;
}

interface ClassWithContext {
  file: ParsedFile;
  cls: ParsedClass;
  info: SpringClassInfo;
}

/**
 * Build a class-level dependency graph from @Autowired fields and
 * constructor-injected parameters. Setter injection (`@Autowired` on a setter
 * method) is also picked up.
 *
 * Type resolution: we match a referenced type to a known bean by looking up
 * (1) its FQN if a matching import exists in the file, (2) its FQN if it's
 * in the same package, (3) its simple name in the global bean index as a
 * last resort. Constructor-injection without `@Autowired` is still treated
 * as injection — Spring 4.3+ infers it for single-constructor classes.
 */
export function buildBeanGraph(
  files: ParsedFile[],
  classInfo: Map<string, SpringClassInfo>
): BeanGraph {
  const classes: ClassWithContext[] = [];
  const nodes: BeanNode[] = [];
  const byId = new Map<string, BeanNode>();
  const bySimpleName = new Map<string, string>();

  for (const file of files) {
    for (const cls of file.classes) {
      const info = classInfo.get(classKey(file, cls));
      if (!info || !info.layer) continue;
      const node: BeanNode = {
        id: fqn(file.packageName, cls.name),
        simpleName: cls.name,
        packageName: file.packageName,
        filePath: file.relPath,
        layer: info.layer,
      };
      nodes.push(node);
      byId.set(node.id, node);
      if (!bySimpleName.has(node.simpleName)) bySimpleName.set(node.simpleName, node.id);
      classes.push({ file, cls, info });
    }
  }

  const edges: BeanEdge[] = [];
  for (const { file, cls } of classes) {
    const fromId = fqn(file.packageName, cls.name);
    const resolveType = (typeName: string): string | null =>
      resolveTypeToBeanId(typeName, file, byId, bySimpleName);

    // Field injection
    for (const field of cls.fields) {
      const isAutowired =
        field.annotations.includes('Autowired') ||
        field.annotations.includes('Inject') ||
        field.annotations.includes('Resource');
      if (!isAutowired) continue;
      const toId = resolveType(field.type);
      if (toId && toId !== fromId) {
        edges.push({ fromId, toId, kind: 'field', typeName: field.type });
      }
    }

    // Constructor injection
    const ctors = cls.constructors;
    const useImplicitInjection = ctors.length === 1;
    for (const ctor of ctors) {
      const explicit =
        ctor.annotations.includes('Autowired') || ctor.annotations.includes('Inject');
      if (!explicit && !useImplicitInjection) continue;
      for (const p of ctor.parameters) {
        const toId = resolveType(p.type);
        if (toId && toId !== fromId) {
          edges.push({ fromId, toId, kind: 'constructor', typeName: p.type });
        }
      }
    }

    // Setter injection
    for (const m of cls.methods) {
      if (!m.name.startsWith('set') || m.parameters.length !== 1) continue;
      if (!m.annotations.includes('Autowired') && !m.annotations.includes('Inject')) continue;
      const p = m.parameters[0]!;
      const toId = resolveType(p.type);
      if (toId && toId !== fromId) {
        edges.push({ fromId, toId, kind: 'setter', typeName: p.type });
      }
    }
  }

  return { nodes, edges, byId, bySimpleName };
}

export function fqn(packageName: string, className: string): string {
  return packageName ? `${packageName}.${className}` : className;
}

export function classKey(file: ParsedFile, cls: ParsedClass): string {
  return `${file.relPath}:${cls.name}:${cls.startLine}`;
}

/**
 * Try to resolve a type name (as written at a use site) to a known bean id.
 *
 * The Java type system means a field like `private FooService foo` can refer
 * to: a same-package class, an imported class, a java.lang.* class, or an
 * unresolved external type. We try those in order.
 */
function resolveTypeToBeanId(
  typeName: string,
  file: ParsedFile,
  byId: Map<string, BeanNode>,
  bySimpleName: Map<string, string>
): string | null {
  const simple = simpleNameOf(typeName);

  // 1. Same package
  const samePackageId = fqn(file.packageName, simple);
  if (byId.has(samePackageId)) return samePackageId;

  // 2. Explicit import (named): import a.b.c.Simple;
  for (const imp of file.imports) {
    if (imp.isAsterisk || imp.isStatic) continue;
    if (importSimpleName(imp.name) === simple && byId.has(imp.name)) {
      return imp.name;
    }
  }

  // 3. Wildcard import: import a.b.c.*;
  for (const imp of file.imports) {
    if (!imp.isAsterisk || imp.isStatic) continue;
    const candidate = `${importPackagePrefix(imp.name)}.${simple}`;
    if (byId.has(candidate)) return candidate;
  }

  // 4. Global fallback by simple name
  return bySimpleName.get(simple) ?? null;
}

function simpleNameOf(typeName: string): string {
  // Strip generics: List<Foo> -> List
  const noGenerics = typeName.replace(/<.*$/s, '').trim();
  // Strip array suffix: Foo[] -> Foo
  const noArrays = noGenerics.replace(/\[\]$/g, '');
  // If it's still dotted, take the last segment
  const dot = noArrays.lastIndexOf('.');
  return dot >= 0 ? noArrays.slice(dot + 1) : noArrays;
}

function importSimpleName(importName: string): string {
  const dot = importName.lastIndexOf('.');
  return dot >= 0 ? importName.slice(dot + 1) : importName;
}

function importPackagePrefix(importName: string): string {
  const dot = importName.lastIndexOf('.');
  return dot >= 0 ? importName.slice(0, dot) : importName;
}
