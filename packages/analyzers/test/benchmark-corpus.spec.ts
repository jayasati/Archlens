import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeRepo } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const snapshotPath = path.join(here, 'fixtures', 'benchmark-snapshots.json');

const corpus = [
  {
    key: 'internshipPortal',
    path: path.join(repoRoot, 'sample-projects', 'internshipPortal-main'),
  },
  {
    key: 'stockTrading',
    path: path.join(repoRoot, 'sample-projects', 'Stock-Trading-Simulation-System-main'),
  },
  {
    key: 'stockBot',
    path: path.join(repoRoot, 'sample-projects', 'StockBOT-main'),
  },
] as const;

// ±10 points per dimension before CI flags a drift. Re-run
// `scripts/update-benchmark-snapshots.mjs` if a change intentionally moves
// the corpus.
const SCORE_TOLERANCE = 10;
// LOC/function/smell counts are mechanical and shouldn't drift unless the
// analyzer's discovery or parsing changes. Tighter tolerance.
const COUNT_TOLERANCE_PCT = 10;

const havePresence = corpus.every((repo) => existsSync(repo.path));
const haveSnapshot = existsSync(snapshotPath);

describe.runIf(havePresence && haveSnapshot)('benchmark corpus', () => {
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
    repos: Record<string, BenchmarkSnapshot>;
  };

  for (const repo of corpus) {
    const expected = snapshot.repos[repo.key];
    if (!expected) {
      it.skip(`${repo.key} (no snapshot entry)`, () => {});
      continue;
    }

    it(`${repo.key} scores within ±${SCORE_TOLERANCE} of snapshot`, async () => {
      const ir = await analyzeRepo(repo.path, { repoName: repo.key });
      const sb = ir.scoreBreakdown;
      const exp = expected.scoreBreakdown;

      for (const dim of ['complexity', 'duplication', 'coupling', 'cohesion', 'smells'] as const) {
        const drift = Math.abs(sb[dim] - exp[dim]);
        expect(
          drift,
          `${repo.key}.${dim}: expected ≈${exp[dim]}, got ${sb[dim]} (drift ${drift.toFixed(2)})`
        ).toBeLessThanOrEqual(SCORE_TOLERANCE);
      }
      const overallDrift = Math.abs(sb.overall - exp.overall);
      expect(
        overallDrift,
        `${repo.key}.overall: expected ≈${exp.overall}, got ${sb.overall}`
      ).toBeLessThanOrEqual(SCORE_TOLERANCE);

      // Mechanical shape checks — large drift on these means file discovery
      // or AST walking changed, not just scoring.
      expect(ir.modules.length).toBe(expected.moduleCount);
      const locDrift = Math.abs(countLoc(ir) - expected.totalLoc) / expected.totalLoc;
      expect(locDrift * 100).toBeLessThanOrEqual(COUNT_TOLERANCE_PCT);
    }, 90_000);
  }
});

function countLoc(ir: Awaited<ReturnType<typeof analyzeRepo>>): number {
  let total = 0;
  for (const m of ir.modules) for (const f of m.files) total += f.loc;
  return total;
}

interface BenchmarkSnapshot {
  languages: string[];
  grade: string;
  scoreBreakdown: {
    complexity: number;
    duplication: number;
    coupling: number;
    cohesion: number;
    smells: number;
    overall: number;
    measurementNotes?: Record<string, string>;
  };
  moduleCount: number;
  edgeCount: number;
  totalLoc: number;
  totalFunctions: number;
  totalClasses: number;
  smellsBySeverity: { critical: number; major: number; minor: number; info: number };
}
