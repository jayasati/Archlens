#!/usr/bin/env node
/**
 * Regenerate the benchmark snapshot file from the current analyzer output.
 *
 * Run after intentional scoring changes. The vitest spec at
 * `test/benchmark-corpus.spec.ts` compares each repo's score breakdown
 * against this snapshot with a ±10 point tolerance per dimension.
 *
 *   pnpm --filter @archlens/analyzers exec node scripts/update-benchmark-snapshots.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { analyzeRepo } from '../dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const corpus = [
  {
    key: 'internshipPortal',
    path: path.join(repoRoot, 'sample-projects', 'internshipPortal-main'),
  },
  {
    key: 'stockTrading',
    path: path.join(repoRoot, 'sample-projects', 'Stock-Trading-Simulation-System-main'),
  },
  { key: 'stockBot', path: path.join(repoRoot, 'sample-projects', 'StockBOT-main') },
];

const snapshot = { generatedAt: new Date().toISOString(), repos: {} };

for (const repo of corpus) {
  process.stdout.write(`Scanning ${repo.key}… `);
  const t0 = Date.now();
  const ir = await analyzeRepo(repo.path, { repoName: repo.key });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  let totalLoc = 0;
  let totalFunctions = 0;
  let totalClasses = 0;
  const smellsBySeverity = { critical: 0, major: 0, minor: 0, info: 0 };
  for (const m of ir.modules) {
    for (const f of m.files) {
      totalLoc += f.loc;
      totalFunctions += f.functions.length;
      totalClasses += f.classes.length;
      for (const fn of f.functions) for (const s of fn.smells) smellsBySeverity[s.severity]++;
      for (const c of f.classes) {
        totalFunctions += c.methods.length;
        for (const s of c.smells) smellsBySeverity[s.severity]++;
        for (const meth of c.methods) for (const s of meth.smells) smellsBySeverity[s.severity]++;
      }
      for (const s of f.smells) smellsBySeverity[s.severity]++;
    }
  }

  snapshot.repos[repo.key] = {
    languages: ir.languages,
    grade: ir.grade,
    scoreBreakdown: ir.scoreBreakdown,
    moduleCount: ir.modules.length,
    edgeCount: ir.edges.length,
    totalLoc,
    totalFunctions,
    totalClasses,
    smellsBySeverity,
    elapsedSeconds: Number(elapsed),
  };

  process.stdout.write(`overall=${ir.scoreBreakdown.overall} grade=${ir.grade} (${elapsed}s)\n`);
}

const outPath = path.join(here, '..', 'test', 'fixtures', 'benchmark-snapshots.json');
await writeFile(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log(`\nWrote ${outPath}`);
