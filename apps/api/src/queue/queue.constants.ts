export const SCAN_QUEUE_NAME = 'scans';

export interface ScanJobData {
  scanId: string;
  repoId: string;
  cloneUrl: string;
  ref?: string;
}
