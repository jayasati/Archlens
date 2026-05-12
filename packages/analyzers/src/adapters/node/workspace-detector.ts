import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface NodeWorkspace {
  /** Absolute path to the workspace root (the directory containing its package.json). */
  absPath: string;
  /** POSIX-style path relative to repoRoot, e.g. `apps/api`. */
  relPath: string;
  /** package.json `name` field if set, else the directory basename. */
  packageName: string;
  /** Module ID used in IR — `mod_<sanitizedName>`. */
  moduleId: string;
  /** Friendly name shown in UI tables. */
  displayName: string;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache']);

/**
 * Discover the workspaces in a Node monorepo. Looks at, in order:
 *   1. `pnpm-workspace.yaml`  (pnpm)
 *   2. root `package.json`'s `workspaces` field  (npm / yarn classic)
 *   3. root `package.json`'s `workspaces.packages` field  (yarn berry)
 *   4. fallback: any `<dir>/package.json` one or two levels deep that looks
 *      like a workspace member (skipping the obvious noise dirs).
 *
 * Returns `[]` for single-package repos so callers can fall back to the
 * legacy path-first-segment heuristic.
 */
export async function detectNodeWorkspaces(repoRoot: string): Promise<NodeWorkspace[]> {
  const absRoot = path.resolve(repoRoot);

  const patterns =
    (await readPnpmWorkspaceYaml(absRoot)) ?? (await readPackageJsonWorkspaces(absRoot)) ?? null;

  let workspaceDirs: string[] = [];
  if (patterns && patterns.length > 0) {
    workspaceDirs = await expandWorkspacePatterns(absRoot, patterns);
  } else {
    // Fallback heuristic: scan one or two levels deep for package.json files
    // (common layouts like `apps/*/package.json`, `packages/*/package.json`).
    workspaceDirs = await heuristicScan(absRoot);
  }

  // Drop the root itself if it accidentally got included, and dedupe.
  const unique = Array.from(new Set(workspaceDirs.filter((d) => path.resolve(d) !== absRoot)));

  const draft: NodeWorkspace[] = [];
  for (const absPath of unique) {
    const rel = toPosix(path.relative(absRoot, absPath));
    const packageName = (await readPackageName(absPath)) ?? path.basename(absPath);
    draft.push({
      absPath,
      relPath: rel,
      packageName,
      moduleId: '',
      displayName: '',
    });
  }

  // Assign moduleId / displayName, disambiguating duplicates by their full
  // relative path. (`apps/api` and `services/api` would otherwise both
  // become `mod_api`.)
  const baseNameCounts = new Map<string, number>();
  for (const ws of draft) {
    const base = lastSegment(ws.relPath);
    baseNameCounts.set(base, (baseNameCounts.get(base) ?? 0) + 1);
  }
  for (const ws of draft) {
    const base = lastSegment(ws.relPath);
    if ((baseNameCounts.get(base) ?? 0) > 1) {
      ws.moduleId = `mod_${sanitize(ws.relPath)}`;
      ws.displayName = ws.relPath;
    } else {
      ws.moduleId = `mod_${sanitize(base)}`;
      ws.displayName = base;
    }
  }

  // Longest-first sort so the workspace lookup uses the most specific match
  // (`packages/foo/sub` wins over `packages/foo`).
  draft.sort((a, b) => b.relPath.length - a.relPath.length);
  return draft;
}

/**
 * Match a file's relative path to its workspace, or null if the file lives
 * outside every detected workspace.
 */
export function workspaceForFile(
  fileRelPath: string,
  workspaces: NodeWorkspace[]
): NodeWorkspace | null {
  const file = toPosix(fileRelPath);
  for (const ws of workspaces) {
    if (ws.relPath === '') continue;
    if (file === ws.relPath || file.startsWith(`${ws.relPath}/`)) return ws;
  }
  return null;
}

async function readPnpmWorkspaceYaml(absRoot: string): Promise<string[] | null> {
  const filePath = path.join(absRoot, 'pnpm-workspace.yaml');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return parsePnpmWorkspaceYaml(raw);
  } catch {
    return null;
  }
}

/**
 * Minimal pnpm-workspace.yaml reader. The file has the shape:
 *
 *   packages:
 *     - 'apps/*'
 *     - 'packages/*'
 *
 * We don't pull in a real YAML parser because the file is tiny and the
 * format is stable; this handles quoted/unquoted strings, comments, and
 * the (rare) inline-array form.
 */
export function parsePnpmWorkspaceYaml(content: string): string[] {
  const patterns: string[] = [];
  const lines = content.split(/\r?\n/);
  let inPackages = false;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (line.trim().length === 0) continue;

    const inlineMatch = line.match(/^\s*packages\s*:\s*\[(.*)\]\s*$/);
    if (inlineMatch) {
      for (const m of inlineMatch[1]!.matchAll(/['"]([^'"]+)['"]|([\w./*-]+)/g)) {
        const v = m[1] ?? m[2];
        if (v) patterns.push(v);
      }
      inPackages = false;
      continue;
    }

    if (/^packages\s*:\s*$/.test(line.trim())) {
      inPackages = true;
      continue;
    }

    if (inPackages) {
      const listItem = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/);
      if (listItem) {
        patterns.push(listItem[1]!.trim());
        continue;
      }
      // A new top-level key terminates the packages: block.
      if (/^[A-Za-z_]/.test(line)) inPackages = false;
    }
  }

  return patterns;
}

async function readPackageJsonWorkspaces(absRoot: string): Promise<string[] | null> {
  const filePath = path.join(absRoot, 'package.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const w = parsed.workspaces;
    if (Array.isArray(w) && w.every((s) => typeof s === 'string')) return w as string[];
    if (
      isRecord(w) &&
      Array.isArray(w.packages) &&
      w.packages.every((s) => typeof s === 'string')
    ) {
      return w.packages as string[];
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function expandWorkspacePatterns(absRoot: string, patterns: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of patterns) {
    const pattern = raw.replace(/\\/g, '/').replace(/\/$/, '');
    if (pattern.startsWith('!')) continue; // negation patterns ignored in v1

    const segments = pattern.split('/').filter((s) => s.length > 0);
    const matches = await expandSegments(absRoot, segments, 0);
    for (const match of matches) {
      if (await hasPackageJson(match)) out.push(match);
    }
  }
  return out;
}

async function expandSegments(current: string, segments: string[], i: number): Promise<string[]> {
  if (i >= segments.length) return [current];
  const seg = segments[i]!;
  if (seg === '**') {
    // Limited globstar support: treat ** as "this level or deeper",
    // cheaply by descending one level at a time.
    const here = await expandSegments(current, segments, i + 1);
    const deeper: string[] = [];
    for (const child of await safeListDirs(current)) {
      if (SKIP_DIRS.has(path.basename(child))) continue;
      deeper.push(...(await expandSegments(child, segments, i)));
    }
    return [...here, ...deeper];
  }
  if (seg.includes('*')) {
    const regex = new RegExp(
      '^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    );
    const matches: string[] = [];
    for (const child of await safeListDirs(current)) {
      const name = path.basename(child);
      if (SKIP_DIRS.has(name)) continue;
      if (regex.test(name)) {
        matches.push(...(await expandSegments(child, segments, i + 1)));
      }
    }
    return matches;
  }
  return expandSegments(path.join(current, seg), segments, i + 1);
}

async function heuristicScan(absRoot: string): Promise<string[]> {
  const out: string[] = [];

  const oneLevel = await safeListDirs(absRoot);
  for (const dir of oneLevel) {
    if (SKIP_DIRS.has(path.basename(dir))) continue;
    if (await hasPackageJson(dir)) out.push(dir);
    // Second level — common for `apps/*/package.json` style layouts even
    // when no workspace config is present.
    const twoLevel = await safeListDirs(dir);
    for (const sub of twoLevel) {
      if (SKIP_DIRS.has(path.basename(sub))) continue;
      if (await hasPackageJson(sub)) out.push(sub);
    }
  }
  // Only treat this as a "monorepo" when there are at least 2 candidates; a
  // single root package.json doesn't make this a monorepo.
  return out.length >= 2 ? out : [];
}

async function safeListDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

async function hasPackageJson(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

async function readPackageName(absDir: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(absDir, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed) && typeof parsed.name === 'string') return parsed.name;
  } catch {
    /* ignore */
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function lastSegment(p: string): string {
  const parts = p.split('/').filter((s) => s.length > 0);
  return parts.length > 0 ? parts[parts.length - 1]! : p;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}
