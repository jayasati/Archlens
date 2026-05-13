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

export interface ReportCycleEdgeDto {
  /** Source module ID of a real directed edge inside the SCC. */
  fromId: string;
  /** Target module ID of the edge. */
  toId: string;
  /** Display name of the source module. */
  fromName: string;
  /** Display name of the target module. */
  toName: string;
}

export interface ReportCycleDto {
  /** All modules in the SCC by ID. Order is the SCC algorithm's pop order. */
  moduleIds: string[];
  /** Same set by display name (parallel to moduleIds). */
  moduleNames: string[];
  /**
   * Every real directed edge among the SCC members. Always present on reports
   * generated after the cycle representation rework; older reports may omit it.
   */
  edges?: ReportCycleEdgeDto[];
  /**
   * Concrete shortest cycle through real edges, by module ID. First and last
   * entries are equal so the loop closes (e.g. ['mod_bot', 'mod_data', 'mod_bot']).
   */
  representativePathIds?: string[];
  /** Same path by display name (parallel to representativePathIds). */
  representativePathNames?: string[];
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
