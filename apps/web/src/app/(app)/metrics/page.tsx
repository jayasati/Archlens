import type { MetricDefinitionDto } from '@archlens/shared-types';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMetricCatalogServer } from '@/lib/api/metric-catalog';
import { MetricCatalogTabs } from '@/components/metrics/metric-catalog-tabs';

export const metadata = {
  title: 'Metrics · Archlens',
};

export default async function MetricsCatalogPage() {
  const metrics = await getMetricCatalogServer().catch(() => [] as MetricDefinitionDto[]);

  return (
    <div className="space-y-6" data-testid="metrics-catalog">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
        <p className="text-sm text-muted-foreground">
          What each scoring dimension measures, how Archlens calculates it, and what the bands and
          targets mean. Definitions live in{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            packages/shared-types/src/domain/metric-catalog.ts
          </code>{' '}
          — edit there and this page updates automatically.
        </p>
      </header>

      {metrics.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Catalog unavailable</CardTitle>
            <CardDescription>
              The Archlens API didn&apos;t return any metric definitions. Make sure the API is
              running at <code>{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <MetricCatalogTabs metrics={metrics} />
      )}

      {metrics.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Overall score weights: {metrics.map((m) => `${m.name} ${m.weight}`).join(' · ')} · Smells
          0.2 (see /smells).
        </p>
      ) : null}
    </div>
  );
}
