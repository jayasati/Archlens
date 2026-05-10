import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Grade, RepositoryDto, ScanDto } from '@archlens/shared-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GradeBadge } from '@/components/score/grade-badge';
import { getSessionToken } from '@/lib/auth/server';
import { ApiError } from '@/lib/api/client';
import { listReposServer } from '@/lib/api/repos';
import { listScansServer } from '@/lib/api/scans';
import { getReportSummaryServer } from '@/lib/api/reports';
import { formatRelativeDate, formatScore } from '@/lib/utils/format';

interface RepoWithLatest {
  repo: RepositoryDto;
  latest:
    | { scan: ScanDto; grade: Grade; overall: number }
    | { scan: ScanDto; grade: null; overall: null }
    | null;
}

type DashboardResult = { kind: 'ok'; rows: RepoWithLatest[] } | { kind: 'error'; message: string };

async function loadDashboard(token: string): Promise<DashboardResult> {
  let repos: RepositoryDto[];
  try {
    repos = await listReposServer(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Surfaced upstream by the page so we can redirect to /login.
      throw e;
    }
    return {
      kind: 'error',
      message:
        e instanceof ApiError
          ? `API ${e.status}: ${e.statusText}`
          : e instanceof Error
            ? e.message
            : 'Unknown error',
    };
  }

  const rows = await Promise.all(
    repos.map(async (repo): Promise<RepoWithLatest> => {
      const scans = await listScansServer(token, repo.id).catch(() => [] as ScanDto[]);
      const latest = scans
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (!latest) return { repo, latest: null };
      if (latest.status !== 'completed' || !latest.reportId) {
        return { repo, latest: { scan: latest, grade: null, overall: null } };
      }
      try {
        const summary = await getReportSummaryServer(token, latest.id);
        return {
          repo,
          latest: { scan: latest, grade: summary.grade, overall: summary.scoreBreakdown.overall },
        };
      } catch {
        return { repo, latest: { scan: latest, grade: null, overall: null } };
      }
    })
  );

  return { kind: 'ok', rows };
}

export default async function DashboardPage() {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  let result: DashboardResult;
  try {
    result = await loadDashboard(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect('/login?reauth=1');
    throw e;
  }

  if (result.kind === 'error') {
    return (
      <Card data-testid="dashboard-error">
        <CardHeader>
          <CardTitle>Could not load dashboard</CardTitle>
          <CardDescription>{result.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The Archlens API may be down. Check that{' '}
            <code>pnpm --filter @archlens/api start:dev</code> is running.
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/integrations">Manage repositories</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = result.rows;

  return (
    <div className="space-y-6" data-testid="dashboard">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length === 0
            ? 'Connect a repository to see its score here.'
            : `${rows.length} connected repository${rows.length === 1 ? '' : 'ies'}.`}
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No repositories yet</CardTitle>
            <CardDescription>Connect a GitHub repository to see its scores here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/integrations">Connect a repository</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ repo, latest }) => (
            <Link
              key={repo.id}
              href={`/repos/${repo.owner}/${repo.name}`}
              className="block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              data-testid="dashboard-repo-card"
            >
              <Card className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{repo.fullName}</CardTitle>
                  <CardDescription>
                    {repo.private ? 'Private' : 'Public'} · default {repo.defaultBranch}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-end justify-between">
                  {latest && latest.grade && latest.overall !== null ? (
                    <>
                      <div>
                        <div className="text-3xl font-semibold">{formatScore(latest.overall)}</div>
                        <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                          updated {formatRelativeDate(latest.scan.createdAt)}
                        </div>
                      </div>
                      <GradeBadge grade={latest.grade} size="md" />
                    </>
                  ) : latest ? (
                    <Badge variant="secondary">Scan {latest.scan.status}</Badge>
                  ) : (
                    <Badge variant="outline">No scans yet</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
