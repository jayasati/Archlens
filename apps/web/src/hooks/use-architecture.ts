'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ArchitectureDto } from '@archlens/shared-types';
import { getArchitecture } from '@/lib/api/architecture';
import { useAuthToken } from './use-auth-token';

export function useArchitecture(
  scanId: string | null | undefined
): UseQueryResult<ArchitectureDto> {
  const token = useAuthToken();
  return useQuery<ArchitectureDto>({
    queryKey: ['architecture', scanId],
    queryFn: () => {
      if (!scanId) throw new Error('scanId required');
      return getArchitecture(token, scanId);
    },
    enabled: Boolean(scanId && token),
  });
}
