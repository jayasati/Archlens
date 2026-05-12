import type { AnalyzerWeights, SmellThresholds } from '../adapters/adapter.interface.js';

export const DEFAULT_WEIGHTS: AnalyzerWeights = {
  complexity: 0.25,
  duplication: 0.15,
  coupling: 0.25,
  cohesion: 0.15,
  smells: 0.2,
};

export const DEFAULT_THRESHOLDS: SmellThresholds = {
  longMethodLoc: 30,
  longMethodComplexity: 10,
  godClassMethods: 10,
  godClassLoc: 200,
  deepNestingDepth: 4,

  longParameterListCount: 5,
  excessiveComplexity: 15,
  highWmc: 50,
  lowCohesionRatio: 0.3,
  hubFanIn: 8,

  magicNumberMin: 2,
  longBooleanOperators: 4,
  largeMatchCases: 8,
  commentedCodeLines: 3,
  todoCommentLimit: 5,
  dataClassMaxMethods: 2,
  lazyClassMaxLoc: 15,
  primitiveObsessionParams: 5,
  godFunctionLoc: 80,
  godFunctionComplexity: 15,

  unstableInstability: 0.8,
  godPackageFiles: 20,
  godPackageLoc: 2000,
  scatteredFanOut: 8,

  largeBinaryBytes: 2 * 1024 * 1024,
};

export function mergeWeights(custom?: Partial<AnalyzerWeights>): AnalyzerWeights {
  return { ...DEFAULT_WEIGHTS, ...(custom ?? {}) };
}

export function mergeThresholds(custom?: Partial<SmellThresholds>): SmellThresholds {
  return { ...DEFAULT_THRESHOLDS, ...(custom ?? {}) };
}
