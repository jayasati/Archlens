import type { Grade } from '@archlens/ir-schema';

export type PrCheckStatus = 'pending' | 'success' | 'failure';

export interface PrCheckDto {
  id: string;
  repoId: string;
  scanId: string;
  prNumber: number;
  status: PrCheckStatus;
  baseScore: number;
  headScore: number;
  delta: number;
  baseGrade: Grade;
  headGrade: Grade;
  newSmells: number;
  removedSmells: number;
  commentMarkdown?: string;
  postedAt?: string;
}
