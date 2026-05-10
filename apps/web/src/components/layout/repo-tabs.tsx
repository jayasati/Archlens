'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface RepoTabsProps {
  owner: string;
  name: string;
}

const tabs: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: '', label: 'Overview' },
  { slug: 'architecture', label: 'Architecture' },
  { slug: 'hotspots', label: 'Hotspots' },
  { slug: 'settings', label: 'Settings' },
];

export function RepoTabs({ owner, name }: RepoTabsProps) {
  const pathname = usePathname();
  const base = `/repos/${owner}/${name}`;

  return (
    <nav className="border-b" data-testid="repo-tabs">
      <ul className="flex gap-1 px-2">
        {tabs.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base;
          const active = pathname === href || (t.slug && pathname.startsWith(`${href}/`));
          return (
            <li key={t.slug || 'overview'}>
              <Link
                href={href}
                className={cn(
                  'inline-flex h-10 items-center px-3 text-sm font-medium border-b-2 -mb-px',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
