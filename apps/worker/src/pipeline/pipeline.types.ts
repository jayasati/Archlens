import type { Repo } from '@archlens/ir-schema';

export interface PipelineInput {
  scanId: string;
  repoId: string;
  cloneUrl: string;
  ref?: string;
}

export interface PipelineContext {
  input: PipelineInput;
  workdir: string;
  repoPath: string;
  languages: string[];
  ir?: Repo;
  reportId?: string;
  irBlobPath?: string;
}

export interface PipelineResult {
  scanId: string;
  reportId: string;
  irBlobPath: string;
}

export interface ProgressReporter {
  step(name: string, percent: number, message?: string): Promise<void>;
}

export const PIPELINE_STEPS = [
  { name: '01-clone', percent: 10 },
  { name: '02-detect-languages', percent: 20 },
  { name: '03-run-adapters', percent: 50 },
  { name: '04-compute-metrics', percent: 60 },
  { name: '05-build-graph', percent: 70 },
  { name: '06-score', percent: 80 },
  { name: '07-render-diagrams', percent: 90 },
  { name: '08-persist', percent: 100 },
] as const;

export type StepName = (typeof PIPELINE_STEPS)[number]['name'];
