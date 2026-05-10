import { notFound, redirect } from 'next/navigation';
import type { ReportModuleScoreDto, ReportSummaryDto, ScanDto } from '@archlens/shared-types';
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
import { ScoreTrendChart, type ScoreTrendPoint } from '@/components/score/score-trend-chart';
import { GradeBadge } from '@/components/score/grade-badge';
import { getSessionToken } from '@/lib/auth/server';
import { findRepoByOwnerAndName } from '@/lib/api/repos';
import { listScansServer } from '@/lib/api/scans';
import { getReportSummaryServer, listReportModulesServer } from '@/lib/api/reports';
import { scoreToGrade } from '@/lib/utils/grade';
import { formatScore } from '@/lib/utils/format';

interface PageProps {
  params: { owner: string; name: string };
}

interface RepoOverviewData {
  summary: ReportSummaryDto | null;
  modules: ReportModuleScoreDto[];
  trend: ScoreTrendPoint[];
  latestScan: ScanDto | null;
}

async function loadRepoOverview(
  token: string,
  owner: string,
  name: string
): Promise<RepoOverviewData | 'not-found'> {
  const repo = await findRepoByOwnerAndName(token, owner, name);
  if (!repo) return 'not-found';

  const scans = await listScansServer(token, repo.id);
  const sorted = scans
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const completed = sorted.filter((s) => s.status === 'completed');
  const latestScan = sorted[0] ?? null;
  const latestCompleted = completed[0] ?? null;

  if (!latestCompleted) {
    return { summary: null, modules: [], trend: [], latestScan };
  }

  const [summary, modules] = await Promise.all([
    getReportSummaryServer(token, latestCompleted.id),
    listReportModulesServer(token, latestCompleted.id),
  ]);

  const trendCandidates = await Promise.all(
    completed.slice(0, 10).map(async (s) => {
      try {
        const r = await getReportSummaryServer(token, s.id);
        return {
          date: new Date(s.createdAt).toLocaleDateString(),
          score: Math.round(r.scoreBreakdown.overall),
        } satisfies ScoreTrendPoint;
      } catch {
        return null;
      }
    })
  );

  const trend = trendCandidates.filter((p): p is ScoreTrendPoint => p !== null).reverse();

  return { summary, modules, trend, latestScan };
}

export default async function RepoOverviewPage({ params }: PageProps) {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  const data = await loadRepoOverview(token, params.owner, params.name);
  if (data === 'not-found') notFound();

  const { summary, modules, trend, latestScan } = data;

  if (!summary) {
    return (
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
              Trigger a scan to see scores for this repository.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const sb = summary.scoreBreakdown;

  return (
    <div className="space-y-6" data-testid="repo-overview">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ScoreCard score={sb.overall} grade={summary.grade} subtitle="Latest scan" />
        <div className="lg:col-span-2">
          <ScoreTrendChart data={trend} />
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
                <TableHead className="text-right">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
