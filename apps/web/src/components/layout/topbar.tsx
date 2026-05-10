'use client';

import { Search, LogOut } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function Topbar() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? session?.user?.email ?? 'Account';

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
        <span className="text-sm text-muted-foreground">{userName}</span>
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
