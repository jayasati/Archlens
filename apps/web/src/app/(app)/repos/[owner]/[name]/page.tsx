import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import type {
  MetricDefinitionDto,
  MetricId,
  ReportModuleScoreDto,
  ReportSummaryDto,
  ScanDto,
} from '@archlens/shared-types';
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
import { RatingTileExpandable } from '@/components/metrics/rating-tile-expandable';
import { ScoreTrendServer, ScoreTrendSkeleton } from '@/components/score/score-trend-server';
import { GradeBadge } from '@/components/score/grade-badge';
import { getSessionToken } from '@/lib/auth/server';
import { loadRepoContext } from '@/lib/api/repo-loader';
import { getReportSummaryServer, listReportModulesServer } from '@/lib/api/reports';
import { getMetricCatalogServer } from '@/lib/api/metric-catalog';
import { RescanButton } from '@/components/scan/rescan-button';
import { scoreToGrade } from '@/lib/utils/grade';
import { formatScore, formatRatio, formatOptionalInt } from '@/lib/utils/format';
import { classifyModuleShape } from '@/lib/utils/module-shape';
import { ExpandableModulesTable } from '@/components/modules/expandable-modules-table';

interface PageProps {
  params: { owner: string; name: string };
}

interface RepoOverviewData {
  token: string;
  repoId: string;
  scanId: string | null;
  summary: ReportSummaryDto | null;
  modules: ReportModuleScoreDto[];
  completedScans: ScanDto[];
  latestScan: ScanDto | null;
  metricCatalog: MetricDefinitionDto[];
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
      scanId: null,
      summary: null,
      modules: [],
      completedScans: [],
      latestScan,
      metricCatalog: [],
    };
  }

  // Trend is fetched lazily inside <ScoreTrendServer> wrapped in Suspense,
  // so score card + ratings + modules paint without waiting on it.
  // The metric catalog is a public, cacheable endpoint — fail soft if it's
  // unreachable so we never block a report from rendering.
  const [summary, modules, metricCatalog] = await Promise.all([
    getReportSummaryServer(token, latestCompleted.id),
    listReportModulesServer(token, latestCompleted.id),
    getMetricCatalogServer().catch(() => [] as MetricDefinitionDto[]),
  ]);

  return {
    token,
    repoId: ctx.repo.id,
    scanId: latestCompleted.id,
    summary,
    modules,
    completedScans: completed,
    latestScan,
    metricCatalog,
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

  const {
    token: serverToken,
    repoId,
    scanId,
    summary,
    modules,
    completedScans,
    latestScan,
    metricCatalog,
  } = data;

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
  const metricBy = new Map<MetricId, MetricDefinitionDto>();
  for (const m of metricCatalog) metricBy.set(m.metricId, m);

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
        <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-5">
          <RatingTileExpandable
            metricId="complexity"
            label="Complexity"
            score={sb.complexity}
            note={sb.measurementNotes?.complexity}
            derivation={sb.derivation?.complexity}
            metric={metricBy.get('complexity')}
            modules={modules}
            topSmells={summary.topSmells}
          />
          <RatingTileExpandable
            metricId="duplication"
            label="Duplication"
            score={sb.duplication}
            note={sb.measurementNotes?.duplication}
            derivation={sb.derivation?.duplication}
            metric={metricBy.get('duplication')}
            modules={modules}
            topSmells={summary.topSmells}
          />
          <RatingTileExpandable
            metricId="coupling"
            label="Coupling"
            score={sb.coupling}
            note={sb.measurementNotes?.coupling}
            derivation={sb.derivation?.coupling}
            metric={metricBy.get('coupling')}
            modules={modules}
            topSmells={summary.topSmells}
          />
          <RatingTileExpandable
            metricId="cohesion"
            label="Cohesion"
            score={sb.cohesion}
            note={sb.measurementNotes?.cohesion}
            derivation={sb.derivation?.cohesion}
            metric={metricBy.get('cohesion')}
            modules={modules}
            topSmells={summary.topSmells}
          />
          <RatingTile
            label="Smells"
            score={sb.smells}
            note={sb.measurementNotes?.smells}
            derivation={sb.derivation?.smells}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        {scanId ? (
          <ExpandableModulesTable scanId={scanId} modules={modules} />
        ) : (
          <ModulesTable modules={modules} />
        )}
      </section>

      {summary.cycles && summary.cycles.length > 0 ? (
        <section data-testid="dependency-cycles">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dependency cycles
          </h2>
          <Card className="p-4">
            <div className="mb-2 text-sm text-muted-foreground">
              {summary.cycles.length} circular dependency
              {summary.cycles.length === 1 ? '' : ' chains'} detected. Each cycle penalises the
              coupling score by 15 points.
            </div>
            <ul className="space-y-2 font-mono text-sm">
              {summary.cycles.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                    cycle {i + 1}
                  </span>
                  <span>{[...c.moduleNames, c.moduleNames[0]].join(' → ')}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function ModulesTable({ modules }: { modules: ReportModuleScoreDto[] }) {
  if (modules.length === 0) {
    return (
      <Card>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="text-center text-muted-foreground">
                No modules detected.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    );
  }

  // Split: single-file modules go to a collapsed group; multi-file modules
  // populate the main table.
  const primary = modules.filter((m) => m.fileCount > 1);
  const small = modules.filter((m) => m.fileCount <= 1);
  // Auto-hide D-main column when no module reports a value — keeps the table
  // tidy on Node/Python-only repos where abstractness isn't computed.
  const showDMain = primary.some((m) => m.martinDistance !== undefined);

  return (
    <div className="space-y-4">
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
              {showDMain ? (
                <TableHead
                  className="text-right"
                  title="|abstractness + instability − 1|. Far from 0 = zone of pain or uselessness."
                >
                  D-main
                </TableHead>
              ) : null}
              <TableHead className="text-right">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {primary.map((m) => {
              const grade = scoreToGrade(Math.max(0, 100 - m.avgComplexity * 5 - m.smellCount * 2));
              const shape = classifyModuleShape(m);
              return (
                <TableRow key={m.id} data-testid="module-row">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      {shape ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${shape.color}`}
                          title={shape.description}
                        >
                          {shape.label}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{m.fileCount}</TableCell>
                  <TableCell className="text-right">{m.totalLoc}</TableCell>
                  <TableCell className="text-right">{formatScore(m.avgComplexity)}</TableCell>
                  <TableCell className="text-right">{m.smellCount}</TableCell>
                  <TableCell className="text-right">{formatOptionalInt(m.fanIn)}</TableCell>
                  <TableCell className="text-right">{formatOptionalInt(m.fanOut)}</TableCell>
                  <TableCell className="text-right">{formatRatio(m.cohesionRatio)}</TableCell>
                  <TableCell className="text-right">{formatRatio(m.instability)}</TableCell>
                  {showDMain ? (
                    <TableCell className="text-right">{formatRatio(m.martinDistance)}</TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <GradeBadge grade={grade} size="sm" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {small.length > 0 ? (
        <details className="rounded-lg border bg-muted/30 p-3 text-sm" data-testid="small-modules">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            {small.length} smaller module{small.length === 1 ? '' : 's'} (single-file)
          </summary>
          <ul className="mt-3 grid grid-cols-1 gap-1 md:grid-cols-2">
            {small.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded px-2 py-1 text-xs"
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">
                  {m.totalLoc} LOC · {m.smellCount} smell{m.smellCount === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
