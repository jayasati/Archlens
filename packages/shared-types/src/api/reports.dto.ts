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

export interface ReportSummaryDto {
  id: string;
  scanId: string;
  repoId: string;
  ir_version: IrVersion;
  grade: Grade;
  scoreBreakdown: ScoreBreakdown;
  counts: ReportCounts;
  topSmells: Smell[];
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
