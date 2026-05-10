import type { ReactNode } from 'react';
import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { RepoTabs } from '@/components/layout/repo-tabs';

interface Props {
  params: { owner: string; name: string };
  children: ReactNode;
}

export default function RepoLayout({ params, children }: Props) {
  return (
    <div className="-mx-6 -my-6 flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Repository</div>
          <Link
            href={`/repos/${params.owner}/${params.name}`}
            className="flex items-center gap-2 text-xl font-semibold"
          >
            <GitBranch className="h-5 w-5" />
            {params.owner}/{params.name}
          </Link>
        </div>
      </div>
      <RepoTabs owner={params.owner} name={params.name} />
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}
