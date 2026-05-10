import type { ScanDto } from '@archlens/shared-types';
import { ScoreTrendChart, type ScoreTrendPoint } from './score-trend-chart';
import { Skeleton } from '@/components/shared/loading-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReportSummaryServer } from '@/lib/api/reports';

interface Props {
  token: string;
  completedScans: ScanDto[];
  max?: number;
}

/**
 * Server component that fetches up to `max` recent report summaries to
 * build a trend. Designed to be wrapped in <Suspense>: the rest of the
 * repo overview can render immediately while this resolves.
 */
export async function ScoreTrendServer({ token, completedScans, max = 5 }: Props) {
  const candidates = await Promise.all(
    completedScans.slice(0, max).map(async (s) => {
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

  const trend = candidates.filter((p): p is ScoreTrendPoint => p !== null).reverse();
  return <ScoreTrendChart data={trend} />;
}

export function ScoreTrendSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">Score trend</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <Skeleton className="h-full w-full" />
      </CardContent>
    </Card>
  );
}
