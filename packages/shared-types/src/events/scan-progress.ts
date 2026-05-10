import type { ScanProgressInfo } from '../api/scans.dto.js';

export const SCAN_EVENTS = {
  Queued: 'scan.queued',
  Started: 'scan.started',
  Progress: 'scan.progress',
  Completed: 'scan.completed',
  Failed: 'scan.failed',
} as const;

export type ScanEventName = (typeof SCAN_EVENTS)[keyof typeof SCAN_EVENTS];

export interface ScanQueuedEvent {
  type: typeof SCAN_EVENTS.Queued;
  scanId: string;
  at: string;
}

export interface ScanStartedEvent {
  type: typeof SCAN_EVENTS.Started;
  scanId: string;
  at: string;
}

export interface ScanProgressEvent extends ScanProgressInfo {
  type: typeof SCAN_EVENTS.Progress;
  scanId: string;
  at: string;
}

export interface ScanCompletedEvent {
  type: typeof SCAN_EVENTS.Completed;
  scanId: string;
  reportId: string;
  at: string;
}

export interface ScanFailedEvent {
  type: typeof SCAN_EVENTS.Failed;
  scanId: string;
  error: string;
  at: string;
}

export type ScanEvent =
  | ScanQueuedEvent
  | ScanStartedEvent
  | ScanProgressEvent
  | ScanCompletedEvent
  | ScanFailedEvent;
