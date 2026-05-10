'use client';

import Link from 'next/link';
import { Search, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthToken } from '@/hooks/use-auth-token';
import { getMe } from '@/lib/api/users';
import { ApiError } from '@/lib/api/client';

export function Topbar() {
  const token = useAuthToken();
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(token),
    enabled: !!token,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 401) return false;
      return count < 1;
    },
    staleTime: 60_000,
  });

  const userName = user?.name ?? user?.githubUsername ?? user?.email ?? 'Account';

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-6 backdrop-blur"
      data-testid="topbar"
    >
      <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <span>Search repositories…</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/account"
          className="text-sm text-muted-foreground hover:text-foreground"
          data-testid="topbar-username"
        >
          {userName}
        </Link>
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
