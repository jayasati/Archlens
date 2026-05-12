import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ClassIR,
  Edge,
  FileIR,
  FunctionIR,
  Language,
  Method,
  Module,
  Repo,
  Smell,
} from '../../ir/types.js';
import { IR_VERSION } from '../../ir/types.js';
import { computeComplexity, NODE_COMPLEXITY } from '../../metrics/complexity.js';
import { detectDeepNesting } from '../../metrics/smells/deep-nesting.js';
import { detectGodClass } from '../../metrics/smells/god-class.js';
import { detectLongMethod } from '../../metrics/smells/long-method.js';
import { computeCoupling, enrichModuleCoupling } from '../../metrics/coupling.js';
import { computeModuleCohesion, type FileEdge } from '../../metrics/cohesion.js';
import { computeScores } from '../../scoring/engine.js';
import { mergeThresholds, mergeWeights } from '../../scoring/weights.default.js';
import { scoreToGrade } from '../../scoring/grading.js';
import { buildModuleGraph } from '../../graph/graph-builder.js';
import { detectCycles } from '../../graph/cycle-detector.js';
import type { Adapter, AnalyzerConfig } from '../adapter.interface.js';
import { parseNodeSource, type ParsedFile } from './ast-walker.js';
import { languageForExtension } from './parser.js';
import { buildNodeFileIndex, loadTsconfig, resolveNodeImport } from './tsconfig-resolver.js';
import {
  classifyNestClass,
  moduleTagsFromClasses,
  type NestClassInfo,
} from './frameworks/nestjs.js';
import {
  detectNodeWorkspaces,
  workspaceForFile,
  type NodeWorkspace,
} from './workspace-detector.js';

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'out',
  'coverage',
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
  'sample-projects',
];

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

export class NodeAdapter implements Adapter {
  /** The adapter declares `typescript` as its primary language; JS files are folded in. */
  readonly language: Language = 'typescript';
  readonly capabilities = {
    complexity: true,
    cohesion: true,
    coupling: true,
    smells: true,
    // TS uses `interface` ubiquitously for structural types (prop shapes, options
    // bags), so Martin abstractness misfires here. Restricted to Java in P6.
    abstractness: false,
  } as const;

  async analyze(repoPath: string, config: AnalyzerConfig): Promise<Repo> {
    const absRepo = path.resolve(repoPath);
    const stat = await fs.stat(absRepo);
    if (!stat.isDirectory()) throw new Error(`Repo path is not a directory: ${absRepo}`);

    const thresholds = mergeThresholds(config.thresholds);
    const weights = mergeWeights(config.weights);

    const files = await collectNodeFiles(absRepo, config.exclude ?? []);
    const relPaths = files.map((f) => f.relPath);
    const workspaces = await detectNodeWorkspaces(absRepo);
    const fileIndex = buildNodeFileIndex(
      absRepo,
      relPaths,
      workspaces.map((w) => ({ packageName: w.packageName, relPath: w.relPath }))
    );
    const tsconfig = await loadTsconfig(absRepo);

    // Pre-bucket every file by its containing workspace so resolveModule can
    // decide whether to sub-split. Workspaces are matched longest-first so a
    // nested workspace wins over its parent.
    const filesByWorkspace = new Map<string, Set<string>>();
    // Inverse map: file → workspace module ID. Used by the cohesion metric
    // to identify "edges that stay within the same workspace" (sibling
    // submodules count as internal at workspace level).
    const fileToWorkspace = new Map<string, string>();
    for (const f of files) {
      const ws = workspaceForFile(f.relPath, workspaces);
      if (!ws) continue;
      let bucket = filesByWorkspace.get(ws.moduleId);
      if (!bucket) {
        bucket = new Set();
        filesByWorkspace.set(ws.moduleId, bucket);
      }
      bucket.add(f.relPath);
      fileToWorkspace.set(f.relPath, ws.moduleId);
    }

    const parsedFiles: Array<ParsedFile> = [];
    for (const file of files) {
      const language = languageForExtension(path.extname(file.relPath));
      if (!language) continue;
      const source = await fs.readFile(file.absPath, 'utf8');
      try {
        const parsed = await parseNodeSource(file.relPath, source, language);
        parsedFiles.push(parsed);
      } catch {
        // Skip unparseable files; better to lose one than to fail the whole scan.
      }
    }

    const languagesPresent = new Set<Language>();
    for (const parsed of parsedFiles) {
      languagesPresent.add(parsed.language === 'javascript' ? 'javascript' : 'typescript');
    }
    if (languagesPresent.size === 0) {
      // Repo had no parseable Node sources; default to typescript so the IR validates.
      languagesPresent.add('typescript');
    }

    const modulesByName = new Map<string, Module>();
    const moduleClassInfo = new Map<string, NestClassInfo[]>();
    const fileEdges: Edge[] = [];
    const cohesionFileEdges: FileEdge[] = [];
    const fileToModule = new Map<string, string>();
    const moduleSizes = new Map<string, { loc: number; fileCount: number }>();
    // Martin distance is Java-only. TypeScript uses `interface` ubiquitously
    // for structural types (props, options bags), so abstractness counts
    // wildly overstate "real" OO abstraction. Node modules deliberately leave
    // abstractness / martinDistance undefined.
    let totalLoc = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalComplexity = 0;
    let hotSpotCount = 0;
    let hotSpotExcess = 0;
    const allSmells: Smell[] = [];

    for (const parsed of parsedFiles) {
      const { moduleId, moduleName } = resolveModule(parsed.relPath, workspaces, filesByWorkspace);
      fileToModule.set(parsed.relPath, moduleId);
      const existingSize = moduleSizes.get(moduleId) ?? { loc: 0, fileCount: 0 };
      moduleSizes.set(moduleId, {
        loc: existingSize.loc + parsed.loc,
        fileCount: existingSize.fileCount + 1,
      });

      const fileIR: FileIR = {
        id: `file_${slugifyPath(parsed.relPath)}`,
        path: parsed.relPath,
        language: parsed.language === 'javascript' ? 'javascript' : 'typescript',
        loc: parsed.loc,
        classes: [],
        functions: [],
        smells: [],
      };
      totalLoc += parsed.loc;

      for (const fn of parsed.functions) {
        const cmplx = computeComplexity(fn.bodyNode, NODE_COMPLEXITY);
        totalFunctions += 1;
        totalComplexity += cmplx.cyclomatic;
        if (cmplx.cyclomatic > thresholds.longMethodComplexity) {
          hotSpotCount += 1;
          hotSpotExcess += cmplx.cyclomatic - thresholds.longMethodComplexity;
        }

        const fnSmells: Smell[] = [];
        const longSmell = detectLongMethod(
          {
            filePath: parsed.relPath,
            name: fn.name,
            startLine: fn.startLine,
            endLine: fn.endLine,
            loc: fn.loc,
            complexity: cmplx.cyclomatic,
          },
          { loc: thresholds.longMethodLoc, complexity: thresholds.longMethodComplexity }
        );
        if (longSmell) fnSmells.push(longSmell);

        const deepSmell = detectDeepNesting(
          {
            filePath: parsed.relPath,
            name: fn.name,
            startLine: fn.startLine,
            endLine: fn.endLine,
            maxNestingDepth: cmplx.maxNestingDepth,
          },
          { depth: thresholds.deepNestingDepth }
        );
        if (deepSmell) fnSmells.push(deepSmell);

        const fnIR: FunctionIR = {
          id: `${fileIR.id}__fn_${sanitize(fn.name)}_${fn.startLine}`,
          name: fn.name,
          signature: fn.signature,
          complexity: cmplx.cyclomatic,
          cognitive: cmplx.cognitive,
          loc: fn.loc,
          smells: fnSmells,
        };
        fileIR.functions.push(fnIR);
        allSmells.push(...fnSmells);
      }

      for (const cls of parsed.classes) {
        totalClasses += 1;
        const methodIRs: Method[] = [];
        const classSmells: Smell[] = [];

        for (const method of cls.methods) {
          const cmplx = computeComplexity(method.bodyNode, NODE_COMPLEXITY);
          totalFunctions += 1;
          totalComplexity += cmplx.cyclomatic;
          if (cmplx.cyclomatic > thresholds.longMethodComplexity) {
            hotSpotCount += 1;
            hotSpotExcess += cmplx.cyclomatic - thresholds.longMethodComplexity;
          }

          const methodSmells: Smell[] = [];
          const longSmell = detectLongMethod(
            {
              filePath: parsed.relPath,
              className: cls.name,
              name: method.name,
              startLine: method.startLine,
              endLine: method.endLine,
              loc: method.loc,
              complexity: cmplx.cyclomatic,
            },
            { loc: thresholds.longMethodLoc, complexity: thresholds.longMethodComplexity }
          );
          if (longSmell) methodSmells.push(longSmell);

          const deepSmell = detectDeepNesting(
            {
              filePath: parsed.relPath,
              className: cls.name,
              name: method.name,
              startLine: method.startLine,
              endLine: method.endLine,
              maxNestingDepth: cmplx.maxNestingDepth,
            },
            { depth: thresholds.deepNestingDepth }
          );
          if (deepSmell) methodSmells.push(deepSmell);

          methodIRs.push({
            id: `${fileIR.id}__cls_${sanitize(cls.name)}__m_${sanitize(method.name)}_${method.startLine}`,
            name: method.name,
            signature: method.signature,
            complexity: cmplx.cyclomatic,
            cognitive: cmplx.cognitive,
            loc: method.loc,
            smells: methodSmells,
          });
          classSmells.push(...methodSmells);
        }

        const godSmell = detectGodClass(
          {
            filePath: parsed.relPath,
            name: cls.name,
            startLine: cls.startLine,
            endLine: cls.endLine,
            loc: cls.loc,
            methodCount: cls.methods.length,
            attributeCount: cls.attributes.length,
          },
          { methods: thresholds.godClassMethods, loc: thresholds.godClassLoc }
        );
        if (godSmell) classSmells.push(godSmell);

        const nestInfo = classifyNestClass(cls);

        const classIR: ClassIR = {
          id: `${fileIR.id}__cls_${sanitize(cls.name)}_${cls.startLine}`,
          name: cls.name,
          fanIn: 0,
          fanOut: 0,
          methods: methodIRs,
          smells: classSmells,
          tags: nestInfo.tags,
        };
        fileIR.classes.push(classIR);
        allSmells.push(...classSmells);

        const collected = moduleClassInfo.get(moduleId) ?? [];
        collected.push(nestInfo);
        moduleClassInfo.set(moduleId, collected);
      }

      const existingModule = modulesByName.get(moduleId);
      if (existingModule) {
        existingModule.files.push(fileIR);
      } else {
        modulesByName.set(moduleId, {
          id: moduleId,
          name: moduleName,
          virtual: false,
          files: [fileIR],
          tags: [],
        });
      }

      // Resolve every import to a known repo file. Track file-level edges
      // (including intra-module) for cohesion; emit module-level edges only
      // when they cross module boundaries.
      for (const imp of parsed.imports) {
        const resolvedRel = resolveNodeImport(parsed.relPath, imp.source, fileIndex, tsconfig);
        if (!resolvedRel) continue;
        cohesionFileEdges.push({ fromFile: parsed.relPath, toFile: resolvedRel });
        const target = resolveModule(resolvedRel, workspaces, filesByWorkspace);
        if (target.moduleId === moduleId) continue;
        fileEdges.push({ from: moduleId, to: target.moduleId, kind: 'import', weight: 1 });
      }
    }

    // Stamp module tags from the classes inside.
    for (const [moduleId, infos] of moduleClassInfo.entries()) {
      const module = modulesByName.get(moduleId);
      if (module) module.tags = moduleTagsFromClasses(infos);
    }

    const modules = Array.from(modulesByName.values()).sort((a, b) => a.id.localeCompare(b.id));
    const aggregatedEdges = aggregateEdges(fileEdges);

    const moduleIds = modules.map((m) => m.id);
    const graph = buildModuleGraph(moduleIds, aggregatedEdges);
    const cycles = detectCycles(graph);

    const coupling = computeCoupling(aggregatedEdges);
    const fanOutValues = Array.from(coupling.fanOut.values());
    const fanOutTotal = fanOutValues.reduce((a, b) => a + b, 0);
    const couplingSummary = enrichModuleCoupling(modules, coupling);

    const cohesion = computeModuleCohesion(
      cohesionFileEdges,
      fileToModule,
      moduleSizes,
      fileToWorkspace
    );
    for (const [mid, ratio] of cohesion.ratios) {
      const mod = modulesByName.get(mid);
      if (mod) mod.cohesionRatio = ratio;
    }
    for (const [mid, ratio] of cohesion.groupRatios) {
      const mod = modulesByName.get(mid);
      if (mod) mod.workspaceCohesionRatio = ratio;
    }

    const scores = computeScores(
      {
        totalLoc,
        totalFunctions,
        totalClasses,
        totalComplexity,
        cycleCount: cycles.length,
        moduleCount: modules.length,
        fanOutTotal,
        fanOutMax: couplingSummary.fanOutMax,
        dualHubMax: couplingSummary.dualHubMax,
        hotSpotCount,
        hotSpotExcess,
        cohesionWeighted: cohesion.cohesionWeighted,
        moduleLocSum: cohesion.moduleLocSum,
        smells: allSmells,
      },
      weights
    );

    const repo: Repo = {
      ir_version: IR_VERSION,
      id: config.repoId ?? `repo_${path.basename(absRepo)}`,
      name: config.repoName ?? path.basename(absRepo),
      scannedAt: new Date().toISOString(),
      languages: Array.from(languagesPresent).sort() as Language[],
      modules,
      edges: aggregatedEdges,
      cycles: cycles.length > 0 ? cycles : undefined,
      scoreBreakdown: scores,
      grade: scoreToGrade(scores.overall),
    };

    return repo;
  }
}

interface FoundFile {
  absPath: string;
  relPath: string;
}

async function collectNodeFiles(repoPath: string, userExcludes: string[]): Promise<FoundFile[]> {
  const excludes = new Set([...DEFAULT_EXCLUDES, ...userExcludes]);
  const out: FoundFile[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (excludes.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!SOURCE_EXTS.has(ext)) continue;
        if (entry.name.endsWith('.d.ts')) continue;
        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) continue;
        const rel = path.relative(repoPath, abs).split(path.sep).join('/');
        out.push({ absPath: abs, relPath: rel });
      }
    }
  };

  await walk(repoPath);
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

function aggregateEdges(edges: Edge[]): Edge[] {
  const key = (e: Edge): string => `${e.from}->${e.to}::${e.kind}`;
  const map = new Map<string, Edge>();
  for (const edge of edges) {
    const k = key(edge);
    const existing = map.get(k);
    if (existing) existing.weight += edge.weight;
    else map.set(k, { ...edge });
  }
  return Array.from(map.values());
}

/**
 * Pick a module for a file. If the file lives inside a detected pnpm/npm/yarn
 * workspace AND that workspace's `src/` has ≥2 distinct first-level
 * subdirectories, split the workspace into per-subdirectory modules
 * (`backend/src/controllers/foo.js` → `mod_backend_controllers`). A workspace
 * with a flat layout stays as one module.
 *
 * The `wsFiles` argument is the set of POSIX-style relative paths of every
 * file inside the workspace (repo-relative). When absent we fall back to the
 * legacy "workspace = module" behaviour, which is what tests that don't care
 * about sub-splitting rely on.
 */
export function resolveModule(
  relPath: string,
  workspaces: NodeWorkspace[],
  wsFiles?: Map<string, Set<string>>
): { moduleId: string; moduleName: string } {
  const ws = workspaceForFile(relPath, workspaces);
  if (ws) {
    if (wsFiles) {
      const files = wsFiles.get(ws.moduleId);
      if (files && shouldSubSplit(files, ws.relPath)) {
        const sub = subPathForFile(relPath, ws.relPath, files);
        if (sub) {
          return {
            moduleId: `${ws.moduleId}_${sanitize(sub.replace(/\//g, '_'))}`,
            moduleName: `${ws.displayName}/${sub}`,
          };
        }
      }
    }
    return { moduleId: ws.moduleId, moduleName: ws.displayName };
  }
  const name = moduleNameForPath(relPath);
  return { moduleId: `mod_${name}`, moduleName: name };
}

/**
 * A workspace is worth sub-splitting when its primary source directory holds
 * at least 2 distinct subdirectories. We look at `<workspace>/src/` if it
 * exists, otherwise the workspace root. Workspaces with one big flat src/ or
 * a single subdir aren't worth fragmenting.
 */
function shouldSubSplit(files: Set<string>, wsRel: string): boolean {
  const prefix = `${wsRel}/`;
  const srcPrefix = `${wsRel}/src/`;
  // Determine the base directory we're inspecting.
  let hasSrc = false;
  for (const f of files) {
    if (f.startsWith(srcPrefix)) {
      hasSrc = true;
      break;
    }
  }
  const base = hasSrc ? srcPrefix : prefix;
  const firstLevelDirs = new Set<string>();
  for (const f of files) {
    if (!f.startsWith(base)) continue;
    const remainder = f.slice(base.length);
    const slash = remainder.indexOf('/');
    if (slash > 0) firstLevelDirs.add(remainder.slice(0, slash));
    if (firstLevelDirs.size >= 2) return true;
  }
  return false;
}

/**
 * Find the submodule path for a file, descending through any directories that
 * contain only subdirectories (no direct files) and stopping at the shallowest
 * directory that holds actual files. Returns `null` when the file lives at the
 * workspace root (e.g. `src/app.js` directly under `src/`).
 */
function subPathForFile(fileRel: string, wsRel: string, wsFiles: Set<string>): string | null {
  const wsRelative = fileRel.slice(wsRel.length + 1);
  const hasSrcPrefix = wsRelative.startsWith('src/');
  const afterSrc = hasSrcPrefix ? wsRelative.slice(4) : wsRelative;
  const segs = afterSrc.split('/').filter((s) => s.length > 0);
  if (segs.length <= 1) return null;

  // Coordinate-space prefix that matches entries in `wsFiles` (which are repo-
  // relative). For each candidate sub-path we test "does this dir contain
  // direct files?" by scanning the set.
  const fileSpaceBase = hasSrcPrefix ? `${wsRel}/src/` : `${wsRel}/`;

  let candidate = '';
  for (let i = 0; i < segs.length - 1; i++) {
    candidate = candidate ? `${candidate}/${segs[i]}` : segs[i]!;
    const dirPrefix = `${fileSpaceBase}${candidate}/`;
    if (directoryHasDirectFile(wsFiles, dirPrefix)) {
      return candidate;
    }
  }
  // Reached the file's own parent directory without finding direct files
  // higher up — use the deepest available prefix.
  return candidate || null;
}

function directoryHasDirectFile(files: Set<string>, dirPrefix: string): boolean {
  for (const f of files) {
    if (!f.startsWith(dirPrefix)) continue;
    const remainder = f.slice(dirPrefix.length);
    if (!remainder.includes('/')) return true;
  }
  return false;
}

/**
 * Single-package fallback used when no workspace contains the file. Strips a
 * leading `src/` and uses the first remaining path segment. Files at the
 * repo root land in their own single-file modules named after the file
 * basename.
 */
export function moduleNameForPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, '/');
  const stripped = norm.replace(/^src\//, '');
  const parts = stripped.split('/').filter((s) => s.length > 0);
  if (parts.length <= 1) return '_root';
  return sanitize(parts[0]!);
}

function slugifyPath(relPath: string): string {
  return relPath.replace(/[^a-zA-Z0-9]/g, '_');
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}
