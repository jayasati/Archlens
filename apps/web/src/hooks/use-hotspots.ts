'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { HotspotDto } from '@archlens/shared-types';
import { listHotspots } from '@/lib/api/hotspots';
import { useAuthToken } from './use-auth-token';

export function useHotspots(scanId: string | null | undefined): UseQueryResult<HotspotDto[]> {
  const token = useAuthToken();
  return useQuery<HotspotDto[]>({
    queryKey: ['hotspots', scanId],
    queryFn: () => {
      if (!scanId) throw new Error('scanId required');
      return listHotspots(token, scanId);
    },
    enabled: Boolean(scanId && token),
  });
}
