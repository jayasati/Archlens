import type { Grade, IrVersion, ScoreBreakdown, Smell } from '@archlens/ir-schema';

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
