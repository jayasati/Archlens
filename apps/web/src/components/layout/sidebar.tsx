'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bug, Gauge, LayoutDashboard, Plug, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const items: ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (pathname: string) => boolean;
}> = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    match: (p) => p === '/dashboard' || p.startsWith('/repos/'),
  },
  {
    href: '/metrics',
    label: 'Metrics',
    icon: Gauge,
    match: (p) => p.startsWith('/metrics'),
  },
  {
    href: '/smells',
    label: 'Smells',
    icon: Bug,
    match: (p) => p.startsWith('/smells'),
  },
  {
    href: '/integrations',
    label: 'Integrations',
    icon: Plug,
    match: (p) => p.startsWith('/integrations'),
  },
  {
    href: '/account',
    label: 'Account',
    icon: User,
    match: (p) => p.startsWith('/account'),
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? '';

  return (
    <aside
      className={cn('flex h-full w-60 shrink-0 flex-col border-r bg-card', className)}
      data-testid="sidebar"
    >
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            AL
          </span>
          Archlens
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              data-active={active}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
