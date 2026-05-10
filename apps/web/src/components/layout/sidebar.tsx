import Link from 'next/link';
import { LayoutDashboard, GitBranch, Settings, Plug } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard', label: 'Repositories', icon: GitBranch },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/account', label: 'Account', icon: Settings },
];

export function Sidebar({ className }: { className?: string }) {
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
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
