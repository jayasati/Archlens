export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface ScanProgressInfo {
  step: string;
  percent: number;
  message?: string;
}

export interface ScanDto {
  id: string;
  repoId: string;
  status: ScanStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress?: ScanProgressInfo;
  reportId?: string;
  error?: string;
}
