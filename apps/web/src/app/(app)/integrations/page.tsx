import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { RepositoryDto } from '@archlens/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectRepoForm } from '@/components/integrations/connect-repo-form';
import { ApiError } from '@/lib/api/client';
import { listReposServer } from '@/lib/api/repos';
import { getSessionToken } from '@/lib/auth/server';

async function loadRepos(token: string): Promise<RepositoryDto[] | { error: 'unauthorized' }> {
  try {
    return await listReposServer(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { error: 'unauthorized' };
    throw e;
  }
}

export default async function IntegrationsPage() {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  const result = await loadRepos(token);
  if ('error' in result) redirect('/login?reauth=1');
  const repos = result;

  return (
    <div className="space-y-6" data-testid="integrations-page">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect repositories you want Archlens to analyze. The full GitHub-app install flow lands
          in a future phase — for now, paste an owner and name.
        </p>
      </header>

      <ConnectRepoForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected repositories</CardTitle>
        </CardHeader>
        <CardContent>
          {repos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repositories connected yet.</p>
          ) : (
            <ul className="divide-y" data-testid="connected-repo-list">
              {repos.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      href={`/repos/${r.owner}/${r.name}`}
                      className="font-medium hover:underline"
                    >
                      {r.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.private ? 'Private' : 'Public'} · default {r.defaultBranch}
                    </div>
                  </div>
                  <a
                    href={r.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View on GitHub
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
