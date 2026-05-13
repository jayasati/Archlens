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

/**
 * When every source file lives under a single top-level package (e.g.
 * `app/`, `src/`, the project name), that package is a wrapper around the
 * real modules — `app/api/`, `app/services/`, etc. Treating the wrapper as
 * the module collapses everything into one bucket, hiding intra-app
 * structure and starving coupling/cohesion analysis of cross-module edges.
 *
 * Iteratively peel wrapper segments while:
 *   - every remaining file shares the same first segment, AND
 *   - that segment contains at least two distinct sub-packages
 *
 * Returns the dotted wrapper prefix (e.g. `'app'`, `'src.myapp'`) or
 * `null` when no peeling is warranted.
 */
export function detectWrapperPackage(relPaths: string[]): string | null {
  const dotteds = relPaths.map(pathToDotted).filter((d) => d.length > 0);
  if (dotteds.length === 0) return null;

  const candidateParts: string[] = [];
  let current = dotteds;

  // Greedy peel: as long as every remaining path shares the same first
  // segment, that segment is part of the wrapper. Safety bound — Python
  // package nesting deeper than this is exotic.
  for (let i = 0; i < 8; i++) {
    const firstSegs = new Set<string>();
    for (const d of current) firstSegs.add(d.split('.')[0]!);
    if (firstSegs.size !== 1) break;
    const candidate = firstSegs.values().next().value as string;
    candidateParts.push(candidate);
    current = current
      .map((d) => {
        const parts = d.split('.');
        return parts.length >= 2 ? parts.slice(1).join('.') : '';
      })
      .filter((d) => d.length > 0);
    if (current.length === 0) break;
  }

  if (candidateParts.length === 0) return null;

  // Commit the peel only if it would actually reveal multiple modules AND
  // at least one of them is a real sub-package (has further nesting).
  // Otherwise the wrapper has only leaf .py siblings — peeling would
  // produce per-file modules, which is rarely useful for flat layouts.
  const remainingFirstSegs = new Set<string>();
  let hasSubpackage = false;
  for (const d of current) {
    remainingFirstSegs.add(d.split('.')[0]!);
    if (d.includes('.')) hasSubpackage = true;
  }
  if (remainingFirstSegs.size < 2 || !hasSubpackage) return null;

  return candidateParts.join('.');
}

/**
 * Pick the module name for a dotted file path, peeling the wrapper prefix
 * first when one was detected. Falls back to {@link topPackage} for paths
 * that don't sit under the wrapper.
 */
export function moduleFor(dotted: string, wrapper: string | null): string {
  if (!dotted) return '_root';
  if (wrapper && (dotted === wrapper || dotted.startsWith(wrapper + '.'))) {
    if (dotted === wrapper) {
      // The wrapper's own __init__.py — bucket it under the wrapper's leaf
      // segment so the file is still represented.
      return wrapper.split('.').pop()!;
    }
    const remaining = dotted.slice(wrapper.length + 1);
    return remaining.split('.')[0]!;
  }
  return topPackage(dotted);
}

export function relativeFromRepo(repoPath: string, absPath: string): string {
  return path.relative(repoPath, absPath).split(path.sep).join('/');
}
