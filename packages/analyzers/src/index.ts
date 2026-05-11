export type {
  Adapter,
  AnalyzerConfig,
  AnalyzerWeights,
  SmellThresholds,
} from './adapters/adapter.interface.js';
export { PythonAdapter } from './adapters/python/python.adapter.js';
export { NodeAdapter } from './adapters/node/node.adapter.js';
export { JavaAdapter, type JavaAdapterOptions } from './adapters/java/java.adapter.js';
export {
  runJavaParserRunner,
  resolveBundledJarPath,
  probeJava,
  JavaNotAvailableError,
  JavaParserRunnerError,
  type JavaParserOutput,
  type JavaParserRunnerOptions,
} from './adapters/java/runners/javaparser.runner.js';
export {
  classifySpringClass,
  moduleTagsFromSpringClasses,
  fileLooksLikeSpring,
  type SpringLayer,
  type SpringClassInfo,
} from './adapters/java/spring/layer-detector.js';
export {
  buildBeanGraph,
  type BeanGraph,
  type BeanNode,
  type BeanEdge,
} from './adapters/java/spring/bean-graph.js';
export {
  applySpringRules,
  type SpringRuleSmell,
  type SpringRulesResult,
} from './adapters/java/spring/spring-rules.js';
export { analyzeRepo, detectLanguages, mergeIRs, type OrchestratorConfig } from './orchestrator.js';
export {
  computeComplexity,
  type FunctionComplexity,
  type ComplexityConfig,
  PYTHON_COMPLEXITY,
  NODE_COMPLEXITY,
} from './metrics/complexity.js';
export { countLoc } from './metrics/size.js';
export { computeCoupling, type CouplingResult } from './metrics/coupling.js';
export { detectGodClass } from './metrics/smells/god-class.js';
export { detectLongMethod } from './metrics/smells/long-method.js';
export { detectDeepNesting } from './metrics/smells/deep-nesting.js';
export { buildModuleGraph } from './graph/graph-builder.js';
export { detectCycles, type Cycle } from './graph/cycle-detector.js';
export { computeScores, type ScoreInput } from './scoring/engine.js';
export { scoreToGrade } from './scoring/grading.js';
export {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  mergeWeights,
  mergeThresholds,
} from './scoring/weights.default.js';
export { buildMermaidModuleGraph } from './diagrams/module-graph.builder.js';
export { buildMermaidLayerDiagram } from './diagrams/layer-diagram.builder.js';
export { parsePythonSource } from './adapters/python/ast-walker.js';
export {
  pathToDotted,
  resolveImport,
  buildModuleIndex,
  topPackage,
} from './adapters/python/import-resolver.js';
export {
  parseNodeSource,
  parseNodeFileByPath,
  type ParsedFile as NodeParsedFile,
  type ParsedClass as NodeParsedClass,
  type ParsedFunction as NodeParsedFunction,
  type ParsedImport as NodeParsedImport,
} from './adapters/node/ast-walker.js';
export {
  loadTsconfig,
  buildNodeFileIndex,
  resolveNodeImport,
  type TsconfigPaths,
  type NodeFileIndex,
} from './adapters/node/tsconfig-resolver.js';
export {
  classifyNestClass,
  moduleTagsFromClasses,
  fileLooksLikeNest,
  type NestLayer,
  type NestClassInfo,
} from './adapters/node/frameworks/nestjs.js';
export {
  fileLooksLikeExpress,
  extractExpressRoutes,
  type ExpressRoute,
} from './adapters/node/frameworks/express.js';
export {
  fileLooksLikeNext,
  extractNextRoute,
  type NextRoute,
  type NextRouterKind,
} from './adapters/node/frameworks/nextjs.js';
