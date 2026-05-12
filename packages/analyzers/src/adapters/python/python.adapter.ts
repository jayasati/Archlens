import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ClassIR,
  Edge,
  FileIR,
  FunctionIR,
  Method,
  Module,
  Repo,
  Smell,
} from '../../ir/types.js';
import { IR_VERSION } from '../../ir/types.js';
import { computeComplexity } from '../../metrics/complexity.js';
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
import { parsePythonSource, type ParsedFile } from './ast-walker.js';
import { buildModuleIndex, pathToDotted, resolveImport, topPackage } from './import-resolver.js';

const DEFAULT_EXCLUDES = [
  '__pycache__',
  '.venv',
  'venv',
  '.git',
  'node_modules',
  'dist',
  'build',
  '.pytest_cache',
  '.tox',
  'test',
  'tests',
  '__tests__',
  'fixtures',
  '__fixtures__',
  'e2e',
  'static',
  'public',
  'assets',
  'resources',
];

export class PythonAdapter implements Adapter {
  readonly language = 'python' as const;

  async analyze(repoPath: string, config: AnalyzerConfig): Promise<Repo> {
    const absRepo = path.resolve(repoPath);
    const stat = await fs.stat(absRepo);
    if (!stat.isDirectory()) {
      throw new Error(`Repo path is not a directory: ${absRepo}`);
    }

    const thresholds = mergeThresholds(config.thresholds);
    const weights = mergeWeights(config.weights);

    const files = await collectPythonFiles(absRepo, config.exclude ?? []);
    const relPaths = files.map((f) => f.relPath);
    const moduleIndex = buildModuleIndex(relPaths);
    const dottedToFile = new Map<string, string>();
    for (const [relPath, dotted] of moduleIndex.byPath) dottedToFile.set(dotted, relPath);

    const parsedFiles: ParsedFile[] = [];
    for (const file of files) {
      const source = await fs.readFile(file.absPath, 'utf8');
      const parsed = await parsePythonSource(file.relPath, source);
      parsedFiles.push(parsed);
    }

    const modulesByName = new Map<string, Module>();
    const fileEdges: Edge[] = [];
    const cohesionFileEdges: FileEdge[] = [];
    const fileToModule = new Map<string, string>();
    const moduleSizes = new Map<string, { loc: number; fileCount: number }>();
    let totalLoc = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalComplexity = 0;
    let hotSpotCount = 0;
    let hotSpotExcess = 0;
    const allSmells: Smell[] = [];

    for (const parsed of parsedFiles) {
      const fileSmells: Smell[] = [];
      const dotted = pathToDotted(parsed.relPath);
      const moduleName = topPackage(dotted);
      const moduleId = `mod_${moduleName}`;

      fileToModule.set(parsed.relPath, moduleId);
      const existingSize = moduleSizes.get(moduleId) ?? { loc: 0, fileCount: 0 };
      moduleSizes.set(moduleId, {
        loc: existingSize.loc + parsed.loc,
        fileCount: existingSize.fileCount + 1,
      });

      const fileIR: FileIR = {
        id: `file_${dotted.replace(/\./g, '_') || 'root'}`,
        path: parsed.relPath,
        language: 'python',
        loc: parsed.loc,
        classes: [],
        functions: [],
        smells: [],
      };
      totalLoc += parsed.loc;

      for (const fn of parsed.functions) {
        const cmplx = computeComplexity(fn.bodyNode);
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
          {
            loc: thresholds.longMethodLoc,
            complexity: thresholds.longMethodComplexity,
          }
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
          id: `${fileIR.id}__fn_${fn.name}_${fn.startLine}`,
          name: fn.name,
          signature: fn.signature,
          complexity: cmplx.cyclomatic,
          cognitive: cmplx.cognitive,
          loc: fn.loc,
          smells: fnSmells,
        };
        fileIR.functions.push(fnIR);
        fileSmells.push(...fnSmells);
      }

      for (const cls of parsed.classes) {
        totalClasses += 1;
        const methodIRs: Method[] = [];
        const classSmells: Smell[] = [];

        for (const method of cls.methods) {
          const cmplx = computeComplexity(method.bodyNode);
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
            {
              loc: thresholds.longMethodLoc,
              complexity: thresholds.longMethodComplexity,
            }
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
            id: `${fileIR.id}__cls_${cls.name}__m_${method.name}_${method.startLine}`,
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

        const classIR: ClassIR = {
          id: `${fileIR.id}__cls_${cls.name}_${cls.startLine}`,
          name: cls.name,
          fanIn: 0,
          fanOut: 0,
          methods: methodIRs,
          smells: classSmells,
          tags: [],
        };
        fileIR.classes.push(classIR);
        fileSmells.push(...classSmells);
      }

      fileIR.smells = [];
      allSmells.push(...fileSmells);

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

      // resolve imports → file-level edges for cohesion + module-level edges for coupling
      for (const imp of parsed.imports) {
        const targetDotted = resolveImport(parsed.relPath, imp, moduleIndex);
        if (!targetDotted) continue;
        const targetFile = dottedToFile.get(targetDotted);
        if (targetFile) cohesionFileEdges.push({ fromFile: parsed.relPath, toFile: targetFile });
        const targetModule = `mod_${topPackage(targetDotted)}`;
        if (targetModule === moduleId) continue;
        fileEdges.push({
          from: moduleId,
          to: targetModule,
          kind: 'import',
          weight: 1,
        });
      }
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

    const cohesion = computeModuleCohesion(cohesionFileEdges, fileToModule, moduleSizes);
    for (const [mid, ratio] of cohesion.ratios) {
      const mod = modulesByName.get(mid);
      if (mod) mod.cohesionRatio = ratio;
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
      languages: ['python'],
      modules,
      edges: aggregatedEdges,
      scoreBreakdown: scores,
      grade: scoreToGrade(scores.overall),
    };

    return repo;
  }
}

function aggregateEdges(edges: Edge[]): Edge[] {
  const key = (e: Edge): string => `${e.from}->${e.to}::${e.kind}`;
  const map = new Map<string, Edge>();
  for (const edge of edges) {
    const k = key(edge);
    const existing = map.get(k);
    if (existing) {
      existing.weight += edge.weight;
    } else {
      map.set(k, { ...edge });
    }
  }
  return Array.from(map.values());
}

interface FoundFile {
  absPath: string;
  relPath: string;
}

async function collectPythonFiles(repoPath: string, userExcludes: string[]): Promise<FoundFile[]> {
  const excludes = new Set([...DEFAULT_EXCLUDES, ...userExcludes]);
  const out: FoundFile[] = [];

  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (excludes.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile() && entry.name.endsWith('.py')) {
        if (entry.name.startsWith('test_') || entry.name.endsWith('_test.py')) continue;
        if (entry.name === 'conftest.py') continue;
        const rel = path.relative(repoPath, abs).split(path.sep).join('/');
        out.push({ absPath: abs, relPath: rel });
      }
    }
  };

  await walk(repoPath);
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}
