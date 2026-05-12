import type { Repo, Language } from '../ir/types.js';

export interface AnalyzerWeights {
  complexity: number;
  duplication: number;
  coupling: number;
  cohesion: number;
  smells: number;
}

export interface SmellThresholds {
  longMethodLoc: number;
  longMethodComplexity: number;
  godClassMethods: number;
  godClassLoc: number;
  deepNestingDepth: number;
}

export interface AnalyzerConfig {
  repoId?: string;
  repoName?: string;
  include?: string[];
  exclude?: string[];
  languages?: Language[];
  weights?: Partial<AnalyzerWeights>;
  thresholds?: Partial<SmellThresholds>;
  /**
   * Skip the cross-language duplication pass (jscpd). Useful for fast scans
   * or environments where the extra 20-60s isn't worth the signal. Duplication
   * weight is treated as 0 for that run regardless of `weights.duplication`.
   */
  skipDuplication?: boolean;
}

export interface Adapter {
  readonly language: Language;
  analyze(repoPath: string, config: AnalyzerConfig): Promise<Repo>;
}
