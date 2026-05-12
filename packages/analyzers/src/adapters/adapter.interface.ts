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

/**
 * What each adapter declares it actually computes. The orchestrator inspects
 * this when merging multi-language IRs so it knows which dimensions to mark
 * as "approximate" or "limited signal" in the breakdown notes. Adding a new
 * metric without claiming it here makes the metric invisible to the merge —
 * the safe default.
 */
export interface AdapterCapabilities {
  /** Per-function cyclomatic + cognitive + nesting (used by hot-spot scoring). */
  complexity: boolean;
  /** Imports → file-level edges, used for cohesion ratio. Java's is `false`
   *  for now because same-package refs need no `import`. */
  cohesion: boolean;
  /** Module-level fan-in / fan-out edges. */
  coupling: boolean;
  /** Long method, god class, deep nesting, framework-specific rules. */
  smells: boolean;
  /** Robert Martin's abstractness + main-sequence distance. */
  abstractness: boolean;
}

export interface Adapter {
  readonly language: Language;
  readonly capabilities: AdapterCapabilities;
  analyze(repoPath: string, config: AnalyzerConfig): Promise<Repo>;
}
