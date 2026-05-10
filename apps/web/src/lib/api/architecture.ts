import type { ArchitectureDto } from '@archlens/shared-types';
import { apiFetch, serverApiFetch } from './client';

export function getArchitecture(token: string | null, scanId: string): Promise<ArchitectureDto> {
  return apiFetch<ArchitectureDto>(`/architecture/${scanId}`, { token });
}

export function getArchitectureServer(token: string, scanId: string): Promise<ArchitectureDto> {
  return serverApiFetch<ArchitectureDto>(`/architecture/${scanId}`, { token });
}
