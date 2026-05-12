import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { ReportModuleScoreDto, ReportSummaryDto, ScanDto } from '@archlens/shared-types';
import { ApiError } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScoreCard } from '@/components/score/score-card';
import { RatingTile } from '@/components/score/rating-tile';
import { ScoreTrendServer, ScoreTrendSkeleton } from '@/components/score/score-trend-server';
import { GradeBadge } from '@/components/score/grade-badge';
import { getSessionToken } from '@/lib/auth/server';
import { loadRepoContext } from '@/lib/api/repo-loader';
import { getReportSummaryServer, listReportModulesServer } from '@/lib/api/reports';
import { RescanButton } from '@/components/scan/rescan-button';
import { scoreToGrade } from '@/lib/utils/grade';
import { formatScore, formatRatio, formatOptionalInt } from '@/lib/utils/format';

interface PageProps {
  params: { owner: string; name: string };
}

interface RepoOverviewData {
  token: string;
  repoId: string;
  summary: ReportSummaryDto | null;
  modules: ReportModuleScoreDto[];
  completedScans: ScanDto[];
  latestScan: ScanDto | null;
}

async function loadRepoOverview(
  token: string,
  owner: string,
  name: string
): Promise<RepoOverviewData | 'not-found'> {
  const ctx = await loadRepoContext(token, owner, name);
  if (!ctx) return 'not-found';

  // ctx.scans is already sorted newest-first by the loader.
  const completed = ctx.scans.filter((s) => s.status === 'completed');
  const latestScan = ctx.scans[0] ?? null;
  const latestCompleted = completed[0] ?? null;

  if (!latestCompleted) {
    return {
      token,
      repoId: ctx.repo.id,
      summary: null,
      modules: [],
      completedScans: [],
      latestScan,
    };
  }

  // Trend is fetched lazily inside <ScoreTrendServer> wrapped in Suspense,
  // so score card + ratings + modules paint without waiting on it.
  const [summary, modules] = await Promise.all([
    getReportSummaryServer(token, latestCompleted.id),
    listReportModulesServer(token, latestCompleted.id),
  ]);

  return {
    token,
    repoId: ctx.repo.id,
    summary,
    modules,
    completedScans: completed,
    latestScan,
  };
}

export default async function RepoOverviewPage({ params }: PageProps) {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  let data: Awaited<ReturnType<typeof loadRepoOverview>>;
  try {
    data = await loadRepoOverview(token, params.owner, params.name);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect('/login?reauth=1');
    throw e;
  }
  if (data === 'not-found') notFound();

  const { token: serverToken, repoId, summary, modules, completedScans, latestScan } = data;

  if (!summary) {
    return (
      <div className="space-y-4" data-testid="repo-overview-empty">
        <RescanButton repoId={repoId} />
        <Card>
          <CardHeader>
            <CardTitle>No completed scan yet</CardTitle>
          </CardHeader>
          <CardContent>
            {latestScan ? (
              <p className="text-sm text-muted-foreground">
                The most recent scan is currently <strong>{latestScan.status}</strong>.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click <strong>Re-scan</strong> above to generate the first report.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const sb = summary.scoreBreakdown;

  return (
    <div className="space-y-6" data-testid="repo-overview">
      <RescanButton repoId={repoId} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ScoreCard score={sb.overall} grade={summary.grade} subtitle="Latest scan" />
        <div className="lg:col-span-2">
          <Suspense fallback={<ScoreTrendSkeleton />}>
            <ScoreTrendServer token={serverToken} completedScans={completedScans} />
          </Suspense>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ratings
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <RatingTile label="Complexity" score={sb.complexity} />
          <RatingTile label="Duplication" score={sb.duplication} />
          <RatingTile label="Coupling" score={sb.coupling} />
          <RatingTile label="Cohesion" score={sb.cohesion} />
          <RatingTile label="Smells" score={sb.smells} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">LOC</TableHead>
                <TableHead className="text-right">Avg cx</TableHead>
                <TableHead className="text-right">Smells</TableHead>
                <TableHead className="text-right" title="Fan-in: # modules importing this one">
                  In
                </TableHead>
                <TableHead className="text-right" title="Fan-out: # modules this one imports">
                  Out
                </TableHead>
                <TableHead
                  className="text-right"
                  title="Internal-edge / total-edge ratio. Higher = more self-contained."
                >
                  Cohesion
                </TableHead>
                <TableHead
                  className="text-right"
                  title="Martin's I = fanOut / (fanIn + fanOut). 0 = stable provider, 1 = volatile consumer."
                >
                  Instab
                </TableHead>
                <TableHead
                  className="text-right"
                  title="|abstractness + instability − 1|. Far from 0 = zone of pain or uselessness."
                >
                  D-main
                </TableHead>
                <TableHead className="text-right">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    No modules detected.
                  </TableCell>
                </TableRow>
              ) : (
                modules.map((m) => {
                  const grade = scoreToGrade(
                    Math.max(0, 100 - m.avgComplexity * 5 - m.smellCount * 2)
                  );
                  return (
                    <TableRow key={m.id} data-testid="module-row">
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-right">{m.fileCount}</TableCell>
                      <TableCell className="text-right">{m.totalLoc}</TableCell>
                      <TableCell className="text-right">{formatScore(m.avgComplexity)}</TableCell>
                      <TableCell className="text-right">{m.smellCount}</TableCell>
                      <TableCell className="text-right">{formatOptionalInt(m.fanIn)}</TableCell>
                      <TableCell className="text-right">{formatOptionalInt(m.fanOut)}</TableCell>
                      <TableCell className="text-right">{formatRatio(m.cohesionRatio)}</TableCell>
                      <TableCell className="text-right">{formatRatio(m.instability)}</TableCell>
                      <TableCell className="text-right">{formatRatio(m.martinDistance)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <GradeBadge grade={grade} size="sm" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
