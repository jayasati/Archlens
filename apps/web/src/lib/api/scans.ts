import type { ScanDto } from '@archlens/shared-types';
import { apiFetch, serverApiFetch } from './client';

export function listScans(token: string | null, repoId?: string): Promise<ScanDto[]> {
  return apiFetch<ScanDto[]>('/scans', { token, query: { repoId } });
}

export function listScansServer(token: string, repoId?: string): Promise<ScanDto[]> {
  return serverApiFetch<ScanDto[]>('/scans', { token, query: { repoId } });
}

export function getScan(token: string | null, id: string): Promise<ScanDto> {
  return apiFetch<ScanDto>(`/scans/${id}`, { token });
}

export function createScan(token: string | null, repoId: string, ref?: string): Promise<ScanDto> {
  return apiFetch<ScanDto>('/scans', {
    method: 'POST',
    token,
    body: { repoId, ...(ref ? { ref } : {}) },
  });
}

export async function getLatestScanForRepo(token: string, repoId: string): Promise<ScanDto | null> {
  const scans = await listScansServer(token, repoId);
  if (scans.length === 0) return null;
  return scans
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]!;
}
