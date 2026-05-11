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
import { computeCoupling } from '../../metrics/coupling.js';
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
];

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

export class NodeAdapter implements Adapter {
  /** The adapter declares `typescript` as its primary language; JS files are folded in. */
  readonly language: Language = 'typescript';

  async analyze(repoPath: string, config: AnalyzerConfig): Promise<Repo> {
    const absRepo = path.resolve(repoPath);
    const stat = await fs.stat(absRepo);
    if (!stat.isDirectory()) throw new Error(`Repo path is not a directory: ${absRepo}`);

    const thresholds = mergeThresholds(config.thresholds);
    const weights = mergeWeights(config.weights);

    const files = await collectNodeFiles(absRepo, config.exclude ?? []);
    const relPaths = files.map((f) => f.relPath);
    const fileIndex = buildNodeFileIndex(absRepo, relPaths);
    const tsconfig = await loadTsconfig(absRepo);

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
    let totalLoc = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalComplexity = 0;
    const allSmells: Smell[] = [];

    for (const parsed of parsedFiles) {
      const moduleName = moduleNameForPath(parsed.relPath);
      const moduleId = `mod_${moduleName}`;

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

      // Resolve every import to a known repo file → emit a module-level edge.
      for (const imp of parsed.imports) {
        const resolvedRel = resolveNodeImport(parsed.relPath, imp.source, fileIndex, tsconfig);
        if (!resolvedRel) continue;
        const targetModule = `mod_${moduleNameForPath(resolvedRel)}`;
        if (targetModule === moduleId) continue;
        fileEdges.push({ from: moduleId, to: targetModule, kind: 'import', weight: 1 });
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
    const fanOutTotal = Array.from(coupling.fanOut.values()).reduce((a, b) => a + b, 0);

    const scores = computeScores(
      {
        totalLoc,
        totalFunctions,
        totalClasses,
        totalComplexity,
        cycleCount: cycles.length,
        moduleCount: modules.length,
        fanOutTotal,
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
 * Group files into modules. We strip a leading `src/` and use the first
 * remaining path segment as the module name. Files at the root land in
 * their own single-file modules named after the file basename.
 */
export function moduleNameForPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, '/');
  const stripped = norm.replace(/^src\//, '');
  const parts = stripped.split('/').filter((s) => s.length > 0);
  if (parts.length === 0) return '_root';
  if (parts.length === 1) {
    // root-level file; module name = basename without extension
    const base = parts[0]!.replace(/\.[^.]+$/, '');
    return sanitize(base);
  }
  return sanitize(parts[0]!);
}

function slugifyPath(relPath: string): string {
  return relPath.replace(/[^a-zA-Z0-9]/g, '_');
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}
