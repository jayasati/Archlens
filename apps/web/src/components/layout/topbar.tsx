import Link from 'next/link';
import { Search } from 'lucide-react';
import type { UserDto } from '@archlens/shared-types';
import { TopbarSignOutButton } from './topbar-sign-out';

interface TopbarProps {
  user: UserDto | null;
}

export function Topbar({ user }: TopbarProps) {
  const name = user?.name ?? user?.githubUsername ?? user?.email ?? 'Account';

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
          {name}
        </Link>
        <TopbarSignOutButton />
      </div>
    </header>
  );
}
