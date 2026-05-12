import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Edge, Language, Module, Repo, Smell } from './ir/types.js';
import { IR_VERSION } from './ir/types.js';
import type { Adapter, AnalyzerConfig } from './adapters/adapter.interface.js';
import { PythonAdapter } from './adapters/python/python.adapter.js';
import { NodeAdapter } from './adapters/node/node.adapter.js';
import { JavaAdapter } from './adapters/java/java.adapter.js';
import { computeCoupling } from './metrics/coupling.js';
import { computeScores } from './scoring/engine.js';
import { mergeThresholds, mergeWeights } from './scoring/weights.default.js';
import { scoreToGrade } from './scoring/grading.js';
import { buildModuleGraph } from './graph/graph-builder.js';
import { detectCycles } from './graph/cycle-detector.js';

const EXT_TO_LANGUAGE: Record<string, Language> = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.java': 'java',
};

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'test',
  'tests',
  '__tests__',
  '__mocks__',
  'fixtures',
  '__fixtures__',
  'e2e',
  'static',
  'public',
  'assets',
  'resources',
]);

export interface OrchestratorConfig extends AnalyzerConfig {
  /** Force a specific set of languages instead of detecting from disk. */
  languages?: Language[];
}

/**
 * Detect languages on disk, dispatch to one adapter per language family,
 * then merge their IRs into a single Repo. Repos with a single language
 * pass straight through (no merge).
 */
export async function analyzeRepo(
  repoPath: string,
  config: OrchestratorConfig = {}
): Promise<Repo> {
  const absRepo = path.resolve(repoPath);
  const languages = config.languages ?? (await detectLanguages(absRepo, config.exclude ?? []));
  if (languages.length === 0) {
    throw new Error('No supported source files detected in repo');
  }

  const adapters = adaptersFor(languages);
  if (adapters.length === 0) {
    throw new Error(`No adapter available for languages: ${languages.join(', ')}`);
  }

  if (adapters.length === 1) {
    return adapters[0]!.analyze(absRepo, config);
  }

  const irs: Repo[] = [];
  for (const adapter of adapters) {
    irs.push(await adapter.analyze(absRepo, config));
  }
  return mergeIRs(irs, absRepo, config);
}

function adaptersFor(languages: Language[]): Adapter[] {
  const set = new Set(languages);
  const adapters: Adapter[] = [];
  if (set.has('python')) adapters.push(new PythonAdapter());
  if (set.has('typescript') || set.has('javascript')) adapters.push(new NodeAdapter());
  if (set.has('java')) adapters.push(new JavaAdapter());
  return adapters;
}

export async function detectLanguages(
  repoPath: string,
  userExcludes: string[] = []
): Promise<Language[]> {
  const skip = new Set([...SKIP_DIRS, ...userExcludes]);
  const counts = new Map<Language, number>();

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const lang = EXT_TO_LANGUAGE[path.extname(entry.name).toLowerCase()];
        if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
      }
    }
  };

  await walk(repoPath);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}

/**
 * Merge multiple IRs from different adapters. Modules and edges are unioned;
 * scores are recomputed against the combined totals so a multi-language repo
 * gets a single coherent grade rather than two competing breakdowns.
 *
 * Module IDs are disambiguated up-front: when two adapters produce the same
 * `mod_X`, both are renamed to `mod_X__<language>` so the merged IR doesn't
 * ship duplicate rows and `buildModuleGraph` doesn't silently collapse them
 * into one node (graphology dedupes by ID).
 */
export function mergeIRs(irs: Repo[], repoPath: string, config: AnalyzerConfig): Repo {
  if (irs.length === 0) throw new Error('mergeIRs called with no IRs');
  if (irs.length === 1) return irs[0]!;

  const disambiguated = disambiguateModuleIds(irs);

  const thresholds = mergeThresholds(config.thresholds);
  const modules: Module[] = [];
  const edges: Edge[] = [];
  const languages = new Set<Language>();
  const allSmells: Smell[] = [];
  let totalLoc = 0;
  let totalFunctions = 0;
  let totalClasses = 0;
  let totalComplexity = 0;
  let hotSpotCount = 0;
  let hotSpotExcess = 0;

  for (const ir of disambiguated) {
    for (const lang of ir.languages) languages.add(lang);
    for (const mod of ir.modules) {
      modules.push(mod);
      for (const file of mod.files) {
        totalLoc += file.loc;
        for (const fn of file.functions) {
          totalFunctions += 1;
          totalComplexity += fn.complexity;
          if (fn.complexity > thresholds.longMethodComplexity) {
            hotSpotCount += 1;
            hotSpotExcess += fn.complexity - thresholds.longMethodComplexity;
          }
          allSmells.push(...fn.smells);
        }
        for (const cls of file.classes) {
          totalClasses += 1;
          for (const m of cls.methods) {
            totalFunctions += 1;
            totalComplexity += m.complexity;
            if (m.complexity > thresholds.longMethodComplexity) {
              hotSpotCount += 1;
              hotSpotExcess += m.complexity - thresholds.longMethodComplexity;
            }
            allSmells.push(...m.smells);
          }
          allSmells.push(...cls.smells);
        }
        allSmells.push(...file.smells);
      }
    }
    for (const edge of ir.edges) edges.push(edge);
  }

  const moduleIds = modules.map((m) => m.id);
  const graph = buildModuleGraph(moduleIds, edges);
  const cycles = detectCycles(graph);
  const coupling = computeCoupling(edges);
  const fanOutValues = Array.from(coupling.fanOut.values());
  const fanOutTotal = fanOutValues.reduce((a, b) => a + b, 0);
  const fanOutMax = fanOutValues.length > 0 ? Math.max(...fanOutValues) : 0;

  const scores = computeScores(
    {
      totalLoc,
      totalFunctions,
      totalClasses,
      totalComplexity,
      cycleCount: cycles.length,
      moduleCount: modules.length,
      fanOutTotal,
      fanOutMax,
      hotSpotCount,
      hotSpotExcess,
      smells: allSmells,
    },
    mergeWeights(config.weights)
  );

  return {
    ir_version: IR_VERSION,
    id: config.repoId ?? irs[0]!.id,
    name: config.repoName ?? irs[0]!.name ?? path.basename(repoPath),
    scannedAt: new Date().toISOString(),
    languages: Array.from(languages).sort() as Language[],
    modules: modules.sort((a, b) => a.id.localeCompare(b.id)),
    edges,
    scoreBreakdown: scores,
    grade: scoreToGrade(scores.overall),
  };
}

/**
 * Rename module IDs that collide across IRs. When the Python adapter walks a
 * Python fixture inside `packages/.../python-fastapi-sample/` it produces
 * `mod_packages`; the Node adapter independently produces `mod_packages` from
 * the `packages/*` TypeScript sources. Without this rewrite the merged IR has
 * two rows with the same ID — and graphology silently keeps only the first
 * when we build the module graph, so coupling/cycle analysis loses one of
 * them. Non-colliding modules pass through unchanged.
 */
export function disambiguateModuleIds(irs: Repo[]): Repo[] {
  const idOwners = new Map<string, Set<number>>();
  irs.forEach((ir, idx) => {
    for (const mod of ir.modules) {
      let set = idOwners.get(mod.id);
      if (!set) {
        set = new Set();
        idOwners.set(mod.id, set);
      }
      set.add(idx);
    }
  });

  const collidingIds = new Set<string>();
  for (const [id, owners] of idOwners) {
    if (owners.size > 1) collidingIds.add(id);
  }
  if (collidingIds.size === 0) return irs;

  return irs.map((ir) => {
    const lang = ir.languages[0] ?? 'unknown';
    const renames = new Map<string, string>();
    for (const mod of ir.modules) {
      if (collidingIds.has(mod.id)) {
        renames.set(mod.id, `${mod.id}__${lang}`);
      }
    }
    if (renames.size === 0) return ir;
    return {
      ...ir,
      modules: ir.modules.map((mod) => {
        const newId = renames.get(mod.id);
        if (!newId) return mod;
        return { ...mod, id: newId, name: `${mod.name} (${lang})` };
      }),
      edges: ir.edges.map((edge) => {
        const from = renames.get(edge.from) ?? edge.from;
        const to = renames.get(edge.to) ?? edge.to;
        if (from === edge.from && to === edge.to) return edge;
        return { ...edge, from, to };
      }),
    };
  });
}
