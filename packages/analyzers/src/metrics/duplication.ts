import path from 'node:path';
import { detectClones } from 'jscpd';
import type { IClone, IOptions } from '@jscpd/core';

export interface CloneLocation {
  /** POSIX-style path relative to the scanned repo root. */
  file: string;
  /** 1-based inclusive line range covering the duplicated fragment. */
  startLine: number;
  endLine: number;
}

export interface CloneInstance {
  /** Stable group identifier shared by both halves of the same duplication. */
  groupId: string;
  /** Source language as reported by the tokenizer (`typescript`, `python`, …). */
  format: string;
  /** Line count of the duplicated fragment (max of the two halves). */
  lines: number;
  locations: [CloneLocation, CloneLocation];
}

export interface DuplicationResult {
  /** duplicateLines / totalLines, clamped to [0, 1]. */
  ratio: number;
  duplicateLines: number;
  totalLines: number;
  clones: CloneInstance[];
}

export interface DuplicationOptions {
  /** Languages (jscpd format names) to scan. Default covers TS/JS/Python/Java. */
  formats?: string[];
  /** Directory names jscpd should never descend into. */
  excludeDirs?: string[];
  /** Minimum token run that counts as a clone (jscpd default 50). */
  minTokens?: number;
  /** Total source LOC, used as denominator for the ratio. Pass from the IR. */
  totalLoc?: number;
}

const DEFAULT_FORMATS = ['typescript', 'javascript', 'python', 'java'];

/**
 * Run jscpd against the repo and return a normalized result.
 *
 * The ratio is computed as `duplicateLines / totalLoc`, not jscpd's own
 * `percentageTokens` — we already have a trustworthy LOC total from the
 * adapters and avoid having to extract internal stats from jscpd.
 */
export async function detectDuplication(
  repoPath: string,
  options: DuplicationOptions = {}
): Promise<DuplicationResult> {
  const formats = options.formats ?? DEFAULT_FORMATS;
  const minTokens = options.minTokens ?? 50;

  // jscpd globs are passed via `ignore`; convert directory names to glob form.
  const ignore = (options.excludeDirs ?? []).map((d) => `**/${d}/**`);

  // jscpd uses fast-glob under the hood; on Windows it only understands
  // POSIX-style separators. Always pass forward-slash paths to avoid
  // silently returning zero clones on Windows.
  const normalizedRepo = path.resolve(repoPath).split(path.sep).join('/');

  const jscpdOptions: IOptions = {
    path: [normalizedRepo],
    format: formats,
    minTokens,
    ignore,
    silent: true,
    noTips: true,
    reporters: [],
    listeners: [],
    cache: false,
    blame: false,
    skipLocal: false,
    ignoreCase: false,
    gitignore: false,
    noSymlinks: true,
    absolute: false,
    mode: 'mild',
  };

  let clones: IClone[];
  try {
    clones = await detectClones(jscpdOptions);
  } catch {
    // jscpd has been known to throw on edge cases (no files of the requested
    // formats, unreadable encodings). Treat as "no duplication detected".
    return { ratio: 0, duplicateLines: 0, totalLines: options.totalLoc ?? 0, clones: [] };
  }

  const instances: CloneInstance[] = [];
  const filesWithRanges = new Map<string, Array<[number, number]>>();

  clones.forEach((clone, idx) => {
    const groupId = `clone_${idx + 1}`;
    const a = toCloneLocation(normalizedRepo, clone.duplicationA);
    const b = toCloneLocation(normalizedRepo, clone.duplicationB);
    const lines = Math.max(a.endLine - a.startLine + 1, b.endLine - b.startLine + 1);
    instances.push({ groupId, format: clone.format, lines, locations: [a, b] });

    for (const loc of [a, b]) {
      const ranges = filesWithRanges.get(loc.file) ?? [];
      ranges.push([loc.startLine, loc.endLine]);
      filesWithRanges.set(loc.file, ranges);
    }
  });

  // Dedup overlapping line ranges per file so a clone with two fragments in
  // the same file doesn't double-count those lines.
  let duplicateLines = 0;
  for (const ranges of filesWithRanges.values()) {
    duplicateLines += sumMergedRanges(ranges);
  }

  const totalLines = options.totalLoc ?? 0;
  const ratio = totalLines > 0 ? Math.min(1, duplicateLines / totalLines) : 0;

  return { ratio, duplicateLines, totalLines, clones: instances };
}

function toCloneLocation(absRepo: string, side: IClone['duplicationA']): CloneLocation {
  // jscpd may return POSIX or platform-native sourceIds depending on how it
  // walked the filesystem; normalize both sides before relativizing.
  const sourcePosix = side.sourceId.split(path.sep).join('/');
  let rel = sourcePosix.startsWith(absRepo + '/')
    ? sourcePosix.slice(absRepo.length + 1)
    : path.relative(absRepo, sourcePosix).split(path.sep).join('/');
  if (rel.startsWith('./')) rel = rel.slice(2);
  return {
    file: rel,
    startLine: side.start.line,
    endLine: side.end.line,
  };
}

function sumMergedRanges(ranges: Array<[number, number]>): number {
  if (ranges.length === 0) return 0;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i]!;
    if (s <= curEnd + 1) {
      if (e > curEnd) curEnd = e;
    } else {
      total += curEnd - curStart + 1;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart + 1;
  return total;
}
