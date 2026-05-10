export const SCAN_QUEUE_NAME = 'scans';
export const SCAN_QUEUE_CONNECTION = 'BULLMQ_WORKER_CONNECTION';

export interface ScanJobData {
  scanId: string;
  repoId: string;
  cloneUrl: string;
  ref?: string;
}
