import path from 'node:path';
import type { ParsedImport } from './ast-walker.js';

export interface ResolvedImport {
  fromFile: string;
  toModule: string;
  raw: ParsedImport;
}

export interface ModuleIndex {
  byPath: Map<string, string>;
  modules: Set<string>;
}

export function buildModuleIndex(relPaths: string[]): ModuleIndex {
  const byPath = new Map<string, string>();
  const modules = new Set<string>();
  for (const rel of relPaths) {
    const dotted = pathToDotted(rel);
    byPath.set(rel, dotted);
    modules.add(dotted);
  }
  return { byPath, modules };
}

export function pathToDotted(relPath: string): string {
  const noExt = relPath.replace(/\.py$/, '');
  const parts = noExt.split(/[\\/]+/).filter((p) => p.length > 0);
  if (parts.length > 0 && parts[parts.length - 1] === '__init__') {
    parts.pop();
  }
  return parts.join('.');
}

export function resolveImport(
  fromFileRel: string,
  imp: ParsedImport,
  index: ModuleIndex
): string | null {
  let target = imp.module;
  if (imp.isRelative) {
    const fromDotted = pathToDotted(fromFileRel);
    const fromPartsRaw = fromDotted ? fromDotted.split('.') : [];
    // `pathToDotted` collapses `pkg/__init__.py` → `'pkg'` because in Python
    // the __init__ file represents the package itself. For relative imports
    // however, the file IS the package, so `from .X` in `pkg/__init__.py`
    // resolves to `pkg.X`, not to a sibling of `pkg`. Compensate by treating
    // an __init__.py source as if it were one path component deeper before
    // applying the level-based strip.
    const isInit = /[/\\]__init__\.py$/i.test(fromFileRel);
    const fromParts = isInit ? [...fromPartsRaw, '__init__'] : fromPartsRaw;
    const stripCount = imp.level;
    const baseParts = fromParts.slice(0, Math.max(0, fromParts.length - stripCount));
    target = imp.module ? [...baseParts, imp.module].join('.') : baseParts.join('.');
  }
  if (!target) return null;

  if (index.modules.has(target)) return target;
  // try parent (e.g. `from app.routers.users import x` may target the module itself)
  const parts = target.split('.');
  while (parts.length > 0) {
    const candidate = parts.join('.');
    if (index.modules.has(candidate)) return candidate;
    parts.pop();
  }
  return null;
}

export function topPackage(dotted: string): string {
  const parts = dotted.split('.');
  if (parts.length === 0 || parts[0]!.length === 0) return '_root';
  return parts[0]!;
}

export function relativeFromRepo(repoPath: string, absPath: string): string {
  return path.relative(repoPath, absPath).split(path.sep).join('/');
}
