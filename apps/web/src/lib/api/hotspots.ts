import type { HotspotDto } from '@archlens/shared-types';
import { apiFetch, serverApiFetch } from './client';

export function listHotspots(token: string | null, scanId: string): Promise<HotspotDto[]> {
  return apiFetch<HotspotDto[]>(`/hotspots/${scanId}`, { token });
}

export function listHotspotsServer(token: string, scanId: string): Promise<HotspotDto[]> {
  return serverApiFetch<HotspotDto[]>(`/hotspots/${scanId}`, { token });
}
