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
import {
  runJavaParserRunner,
  type JavaParserOutput,
  type ParsedClass,
  type ParsedFile,
  type ParsedMethod,
  type JavaParserRunnerOptions,
} from './runners/javaparser.runner.js';
import {
  classifySpringClass,
  moduleTagsFromSpringClasses,
  type SpringClassInfo,
} from './spring/layer-detector.js';
import { buildBeanGraph, classKey, fqn, type BeanGraph } from './spring/bean-graph.js';
import { applySpringRules } from './spring/spring-rules.js';

// Reserved as an extension point: callers can augment via declaration
// merging without touching JavaParserRunnerOptions itself.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JavaAdapterOptions extends JavaParserRunnerOptions {}

export class JavaAdapter implements Adapter {
  readonly language: Language = 'java';

  constructor(private readonly options: JavaAdapterOptions = {}) {}

  async analyze(repoPath: string, config: AnalyzerConfig): Promise<Repo> {
    const absRepo = path.resolve(repoPath);
    const thresholds = mergeThresholds(config.thresholds);
    const weights = mergeWeights(config.weights);

    const runner = await runJavaParserRunner(absRepo, this.options);
    return transformRunnerOutput(runner, absRepo, config, thresholds, weights);
  }
}

interface ThresholdsResolved {
  longMethodLoc: number;
  longMethodComplexity: number;
  godClassMethods: number;
  godClassLoc: number;
  deepNestingDepth: number;
}

interface WeightsResolved {
  complexity: number;
  duplication: number;
  coupling: number;
  cohesion: number;
  smells: number;
}

function transformRunnerOutput(
  runner: JavaParserOutput,
  absRepo: string,
  config: AnalyzerConfig,
  thresholds: ThresholdsResolved,
  weights: WeightsResolved
): Repo {
  const modulesByName = new Map<string, Module>();
  const moduleSpringInfo = new Map<string, SpringClassInfo[]>();
  const allSmells: Smell[] = [];
  const fileEdges: Edge[] = [];
  let totalLoc = 0;
  let totalFunctions = 0;
  let totalClasses = 0;
  let totalComplexity = 0;

  // Pre-classify every class so the bean graph and the IR pass agree on
  // which classes count as beans.
  const classInfo = new Map<string, SpringClassInfo>();
  for (const file of runner.files) {
    for (const cls of file.classes) {
      classInfo.set(classKey(file, cls), classifySpringClass(cls));
    }
  }

  const beanGraph = buildBeanGraph(runner.files, classInfo);
  const springRules = applySpringRules(beanGraph);
  const springSmellsByBean = new Map<string, Smell[]>();
  for (const s of springRules.smells) {
    const list = springSmellsByBean.get(s.beanId) ?? [];
    list.push(s);
    springSmellsByBean.set(s.beanId, list);
    allSmells.push(s);
  }

  for (const file of runner.files) {
    const moduleName = moduleNameForPackage(file.packageName, file.relPath);
    const moduleId = `mod_${sanitize(moduleName)}`;

    const fileIR: FileIR = {
      id: `file_${slugifyPath(file.relPath)}`,
      path: file.relPath,
      language: 'java',
      loc: file.loc,
      classes: [],
      functions: [],
      smells: [],
    };
    totalLoc += file.loc;

    for (const cls of file.classes) {
      totalClasses += 1;
      const methodIRs: Method[] = [];
      const classSmells: Smell[] = [];
      const info = classInfo.get(classKey(file, cls)) ?? { layer: null, tags: [] };

      for (const m of [...cls.constructors, ...cls.methods]) {
        const methodSmells: Smell[] = [];
        totalFunctions += 1;
        totalComplexity += m.cyclomatic;

        const longSmell = detectLongMethod(
          {
            filePath: file.relPath,
            className: cls.name,
            name: m.name,
            startLine: m.startLine,
            endLine: m.endLine,
            loc: m.loc,
            complexity: m.cyclomatic,
          },
          { loc: thresholds.longMethodLoc, complexity: thresholds.longMethodComplexity }
        );
        if (longSmell) methodSmells.push(longSmell);

        const deepSmell = detectDeepNesting(
          {
            filePath: file.relPath,
            className: cls.name,
            name: m.name,
            startLine: m.startLine,
            endLine: m.endLine,
            maxNestingDepth: m.maxNestingDepth,
          },
          { depth: thresholds.deepNestingDepth }
        );
        if (deepSmell) methodSmells.push(deepSmell);

        methodIRs.push({
          id: `${fileIR.id}__cls_${sanitize(cls.name)}__m_${sanitize(m.name)}_${m.startLine}`,
          name: m.name,
          signature: m.signature,
          complexity: m.cyclomatic,
          cognitive: m.cognitive,
          loc: m.loc,
          smells: methodSmells,
        });
        classSmells.push(...methodSmells);
      }

      const godSmell = detectGodClass(
        {
          filePath: file.relPath,
          name: cls.name,
          startLine: cls.startLine,
          endLine: cls.endLine,
          loc: cls.loc,
          methodCount: cls.methods.length + cls.constructors.length,
          attributeCount: cls.fields.length,
        },
        { methods: thresholds.godClassMethods, loc: thresholds.godClassLoc }
      );
      if (godSmell) classSmells.push(godSmell);

      const beanId = fqn(file.packageName, cls.name);
      const ownSpringSmells = springSmellsByBean.get(beanId) ?? [];
      classSmells.push(...ownSpringSmells);

      const classIR: ClassIR = {
        id: `${fileIR.id}__cls_${sanitize(cls.name)}_${cls.startLine}`,
        name: cls.name,
        fanIn: 0,
        fanOut: 0,
        methods: methodIRs,
        smells: classSmells,
        tags: info.tags,
      };
      fileIR.classes.push(classIR);
      allSmells.push(...classSmells.filter((s) => !ownSpringSmells.includes(s as never)));

      const collected = moduleSpringInfo.get(moduleId) ?? [];
      collected.push(info);
      moduleSpringInfo.set(moduleId, collected);
    }

    // No top-level functions in Java — everything lives in classes.
    fileIR.functions = [] as FunctionIR[];

    const existing = modulesByName.get(moduleId);
    if (existing) existing.files.push(fileIR);
    else
      modulesByName.set(moduleId, {
        id: moduleId,
        name: moduleName,
        virtual: false,
        files: [fileIR],
        tags: [],
      });

    // Build module-level edges from imports.
    for (const imp of file.imports) {
      const targetPackage = packageOfImport(imp.name);
      if (!targetPackage) continue;
      if (targetPackage.startsWith('java.') || targetPackage.startsWith('javax.')) continue;
      if (targetPackage.startsWith('org.springframework')) continue;
      const targetModuleName = moduleNameForPackage(targetPackage, '');
      const targetModuleId = `mod_${sanitize(targetModuleName)}`;
      if (targetModuleId === moduleId) continue;
      fileEdges.push({ from: moduleId, to: targetModuleId, kind: 'import', weight: 1 });
    }
  }

  // Stamp module tags from the spring layers inside.
  for (const [moduleId, infos] of moduleSpringInfo.entries()) {
    const mod = modulesByName.get(moduleId);
    if (mod) mod.tags = moduleTagsFromSpringClasses(infos);
  }

  // Filter edges to only target modules we actually know about — otherwise
  // imports of third-party packages would create dangling target nodes.
  const knownModuleIds = new Set(Array.from(modulesByName.keys()));
  const usableEdges = fileEdges.filter((e) => knownModuleIds.has(e.to));

  const modules = Array.from(modulesByName.values()).sort((a, b) => a.id.localeCompare(b.id));
  const aggregatedEdges = aggregateEdges(usableEdges);
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
    languages: ['java'],
    modules,
    edges: aggregatedEdges,
    scoreBreakdown: scores,
    grade: scoreToGrade(scores.overall),
  };
  return repo;
}

/**
 * Group files into modules using the package's last segment — the feature
 * name in the canonical Spring layout `<group>.<artifact>.<feature>`. The
 * app's root class (`com.example.petclinic.PetclinicApplication`) lands in
 * the artifact's module (`petclinic`); feature subpackages get their own.
 * Files outside any package land in a `_root` module.
 */
export function moduleNameForPackage(packageName: string, _relPath: string): string {
  if (!packageName) return '_root';
  const parts = packageName.split('.').filter((p) => p.length > 0);
  if (parts.length === 0) return '_root';
  return parts[parts.length - 1]!;
}

function packageOfImport(importName: string): string | null {
  // import com.foo.bar.Baz   -> package "com.foo.bar"
  // import com.foo.bar.*     -> package "com.foo.bar"
  const lastDot = importName.lastIndexOf('.');
  if (lastDot < 0) return null;
  return importName.slice(0, lastDot);
}

function aggregateEdges(edges: Edge[]): Edge[] {
  const map = new Map<string, Edge>();
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}::${edge.kind}`;
    const existing = map.get(key);
    if (existing) existing.weight += edge.weight;
    else map.set(key, { ...edge });
  }
  return Array.from(map.values());
}

function slugifyPath(relPath: string): string {
  return relPath.replace(/[^a-zA-Z0-9]/g, '_');
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

// Re-exports for tests/integration code that wants to call the bean graph
// against custom inputs.
export { buildBeanGraph, applySpringRules };
export type { BeanGraph, ParsedClass, ParsedFile, ParsedMethod };
