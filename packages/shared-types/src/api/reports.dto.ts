import type {
  ClassIR,
  FunctionIR,
  Grade,
  IrVersion,
  Language,
  ScoreBreakdown,
  Smell,
} from '@archlens/ir-schema';

export interface ReportCounts {
  modules: number;
  files: number;
  classes: number;
  functions: number;
  smells: number;
}

export interface ReportCycleDto {
  /** Module IDs in cycle order (e.g. ['mod_bot', 'mod_data', 'mod_bot']). */
  moduleIds: string[];
  /** Same nodes by display name, for UI rendering. */
  moduleNames: string[];
}

export interface ReportSummaryDto {
  id: string;
  scanId: string;
  repoId: string;
  ir_version: IrVersion;
  grade: Grade;
  scoreBreakdown: ScoreBreakdown;
  counts: ReportCounts;
  topSmells: Smell[];
  /** Detected dependency cycles in the module graph. Absent when none. */
  cycles?: ReportCycleDto[];
  generatedAt: string;
  irBlobUrl?: string;
}

export interface ReportModuleScoreDto {
  id: string;
  irModuleId: string;
  name: string;
  virtual: boolean;
  fileCount: number;
  classCount: number;
  functionCount: number;
  smellCount: number;
  totalLoc: number;
  totalComplexity: number;
  avgComplexity: number;
  maxComplexity: number;
  /** Internal-edge / total-edge ratio. Undefined for single-file or leaf modules. */
  cohesionRatio?: number;
  /** Number of distinct other modules that import this one. */
  fanIn?: number;
  /** Number of distinct other modules this one imports. */
  fanOut?: number;
  /** Robert Martin's instability: fanOut / (fanIn + fanOut). Undefined when isolated. */
  instability?: number;
  /** Fraction of declared types that are abstract (interface / abstract class). */
  abstractness?: number;
  /** |abstractness + instability − 1| — distance from the main sequence. */
  martinDistance?: number;
  /**
   * Per-module sub-scores out of 100, computed with the same engine as the
   * repo-level breakdown but scoped locally. `duplication` is always 100 here
   * (jscpd runs repo-wide). Undefined on older reports that predate this.
   */
  scoreBreakdown?: ScoreBreakdown;
}

export interface ReportModuleFileDto {
  id: string;
  irFileId: string;
  path: string;
  language: Language;
  loc: number;
  complexity: number;
  smellCount: number;
}

export interface ReportModuleDetailDto extends ReportModuleScoreDto {
  files: ReportModuleFileDto[];
  /**
   * Every smell whose `file` resolves into a file in this module — already
   * aggregated server-side so the UI doesn't need a per-file fan-out fetch.
   */
  smells: Smell[];
}

export interface ReportFileDetailDto {
  id: string;
  reportId: string;
  irFileId: string;
  moduleId: string;
  moduleName: string;
  path: string;
  language: Language;
  loc: number;
  totalComplexity: number;
  avgComplexity: number;
  classes: ClassIR[];
  functions: FunctionIR[];
  smells: Smell[];
}
