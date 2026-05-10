'use client';

import { useSession } from 'next-auth/react';

export function useAuthToken(): string | null {
  const { data: session } = useSession();
  return session?.archlensAccessToken ?? null;
}
