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
};

export function mergeWeights(custom?: Partial<AnalyzerWeights>): AnalyzerWeights {
  return { ...DEFAULT_WEIGHTS, ...(custom ?? {}) };
}

export function mergeThresholds(custom?: Partial<SmellThresholds>): SmellThresholds {
  return { ...DEFAULT_THRESHOLDS, ...(custom ?? {}) };
}
