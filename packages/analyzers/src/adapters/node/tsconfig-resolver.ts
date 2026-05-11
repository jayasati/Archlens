import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface TsconfigPaths {
  /** Absolute path to the directory baseUrl is rooted at, or `null` if no baseUrl. */
  baseUrl: string | null;
  /** Absolute root that path-aliases resolve relative to (paths use baseUrl when set, otherwise tsconfig dir). */
  pathsBase: string;
  /** Aliases keyed by their literal pattern, e.g. `@app/*`. */
  paths: Record<string, string[]>;
}

export interface NodeFileIndex {
  /** All known source files as POSIX-style relative paths from repo root. */
  relPaths: Set<string>;
  /** Same set keyed by absolute path. */
  absSet: Set<string>;
  /** repoRoot in absolute form. */
  repoRoot: string;
}

const RESOLVE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.d.ts'];

export async function loadTsconfig(repoRoot: string): Promise<TsconfigPaths | null> {
  const candidates = ['tsconfig.json', 'tsconfig.base.json'];
  for (const name of candidates) {
    const abs = path.join(repoRoot, name);
    try {
      const raw = await fs.readFile(abs, 'utf8');
      const parsed = parseJsonWithComments(raw);
      const compilerOptions =
        isRecord(parsed) && isRecord(parsed.compilerOptions) ? parsed.compilerOptions : {};
      const baseUrlRel =
        typeof compilerOptions.baseUrl === 'string' ? compilerOptions.baseUrl : null;
      const baseUrl = baseUrlRel ? path.resolve(path.dirname(abs), baseUrlRel) : null;
      const pathsBase = baseUrl ?? path.dirname(abs);
      const paths: Record<string, string[]> = {};
      const rawPaths = compilerOptions.paths;
      if (isRecord(rawPaths)) {
        for (const [pattern, targets] of Object.entries(rawPaths)) {
          if (Array.isArray(targets) && targets.every((t) => typeof t === 'string')) {
            paths[pattern] = targets as string[];
          }
        }
      }
      return { baseUrl, pathsBase, paths };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function buildNodeFileIndex(repoRoot: string, relPaths: string[]): NodeFileIndex {
  const absRepo = path.resolve(repoRoot);
  const relSet = new Set(relPaths.map(toPosix));
  const absSet = new Set<string>();
  for (const rel of relSet) absSet.add(path.resolve(absRepo, rel));
  return { relPaths: relSet, absSet, repoRoot: absRepo };
}

/**
 * Resolve a raw `import` specifier from `fromFileRel` to a known repo file.
 * Returns the POSIX-style relative path, or null if it points outside the repo
 * or to a node_modules package.
 */
export function resolveNodeImport(
  fromFileRel: string,
  specifier: string,
  index: NodeFileIndex,
  tsconfig: TsconfigPaths | null
): string | null {
  const fromAbs = path.resolve(index.repoRoot, fromFileRel);
  const fromDir = path.dirname(fromAbs);

  if (specifier.startsWith('.')) {
    const target = path.resolve(fromDir, specifier);
    return probeFileTarget(target, index);
  }

  if (specifier.startsWith('/')) {
    return null;
  }

  if (tsconfig) {
    const aliasResolved = resolveAlias(specifier, tsconfig);
    for (const candidate of aliasResolved) {
      const hit = probeFileTarget(candidate, index);
      if (hit) return hit;
    }
  }

  // Bare specifier with no matching alias — assume external (node_modules).
  return null;
}

function resolveAlias(specifier: string, tsconfig: TsconfigPaths): string[] {
  const out: string[] = [];
  for (const [pattern, targets] of Object.entries(tsconfig.paths)) {
    const match = matchPattern(pattern, specifier);
    if (match === null) continue;
    for (const target of targets) {
      const expanded = target.includes('*') ? target.replace('*', match) : target;
      out.push(path.resolve(tsconfig.pathsBase, expanded));
    }
  }
  return out;
}

function matchPattern(pattern: string, specifier: string): string | null {
  const star = pattern.indexOf('*');
  if (star < 0) {
    return pattern === specifier ? '' : null;
  }
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
  const middle = specifier.slice(prefix.length, specifier.length - suffix.length);
  return middle;
}

function probeFileTarget(absTarget: string, index: NodeFileIndex): string | null {
  // Direct file hit.
  if (index.absSet.has(absTarget)) return toRel(absTarget, index.repoRoot);

  // Try with each extension.
  for (const ext of RESOLVE_EXTS) {
    const withExt = absTarget + ext;
    if (index.absSet.has(withExt)) return toRel(withExt, index.repoRoot);
  }

  // Try as directory with index file.
  for (const ext of RESOLVE_EXTS) {
    const withIndex = path.join(absTarget, 'index' + ext);
    if (index.absSet.has(withIndex)) return toRel(withIndex, index.repoRoot);
  }

  return null;
}

function toRel(abs: string, repoRoot: string): string {
  return toPosix(path.relative(repoRoot, abs));
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * JSONC parser tolerant to // and /* comments and trailing commas.
 * Implemented as a small string-aware state machine so that comment-shaped
 * substrings inside JSON strings (e.g. `"src/**\/*"` or `"@app/*"`) are not
 * accidentally eaten.
 */
function parseJsonWithComments(raw: string): unknown {
  let out = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < raw.length) {
    const c = raw[i]!;
    const next = i + 1 < raw.length ? raw[i + 1]! : '';
    if (inString) {
      out += c;
      if (c === '\\' && i + 1 < raw.length) {
        out += raw[i + 1]!;
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = raw.indexOf('*/', i + 2);
      if (end < 0) {
        i = raw.length;
      } else {
        i = end + 2;
      }
      continue;
    }
    if (c === '/' && next === '/') {
      const end = raw.indexOf('\n', i + 2);
      if (end < 0) {
        i = raw.length;
      } else {
        i = end;
      }
      continue;
    }
    out += c;
    i++;
  }
  out = out.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}
