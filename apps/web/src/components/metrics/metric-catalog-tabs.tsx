'use client';

import Link from 'next/link';
import type { MetricDefinitionDto, MetricScoreBand } from '@archlens/shared-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/cn';

const BAND_TONE: Record<MetricScoreBand['label'], string> = {
  Excellent: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  Good: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'At risk': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  Critical: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

export function MetricCatalogTabs({ metrics }: { metrics: MetricDefinitionDto[] }) {
  if (metrics.length === 0) return null;
  const first = metrics[0]!.metricId;
  return (
    <Tabs defaultValue={first} className="space-y-4">
      <TabsList className="flex flex-wrap" data-testid="metric-tabs">
        {metrics.map((m) => (
          <TabsTrigger key={m.metricId} value={m.metricId} data-testid={`metric-tab-${m.metricId}`}>
            {m.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {metrics.map((m) => (
        <TabsContent key={m.metricId} value={m.metricId}>
          <MetricDetail metric={m} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function MetricDetail({ metric }: { metric: MetricDefinitionDto }) {
  return (
    <div className="space-y-6" data-testid="metric-detail" data-metric-id={metric.metricId}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{metric.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{metric.shortDescription}</p>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              weight {metric.weight}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{metric.description}</p>
        </CardContent>
      </Card>

      <Section title="Formula">
        <ol className="space-y-3">
          {metric.formula.map((step, i) => (
            <li key={step.label} className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
                <span className="text-sm font-semibold">{step.label}</span>
              </div>
              <pre className="mt-2 overflow-x-auto rounded bg-background px-2 py-1.5 text-xs font-mono">
                {step.expression}
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">{step.explanation}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Score derivation: <code className="font-mono">{metric.scoreDerivation}</code>
        </p>
      </Section>

      <Section title="Inputs">
        <ul className="space-y-2">
          {metric.inputs.map((input) => (
            <li key={input.name} className="text-sm">
              <span className="font-mono text-xs">{input.name}</span>
              <span className="text-muted-foreground"> — {input.description}</span>
              <span className="mt-0.5 block text-[11px] font-mono text-muted-foreground/80">
                {input.source}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Score bands">
        <ul className="space-y-2">
          {metric.bands.map((band) => (
            <li
              key={band.label}
              className="flex items-start gap-3 rounded-md border p-3"
              data-band={band.label}
            >
              <span
                className={cn(
                  'shrink-0 rounded px-2 py-0.5 text-xs font-semibold',
                  BAND_TONE[band.label]
                )}
              >
                {band.min}–{band.max}
              </span>
              <div className="text-sm">
                <div className="font-medium">{band.label}</div>
                <div className="text-muted-foreground">{band.meaning}</div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Optimal target">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Aim for {metric.optimal.min}+
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{metric.optimal.rationale}</p>
        </div>
      </Section>

      <Section title="How to improve">
        <ol className="space-y-3">
          {metric.improvementPlaybook.map((step, i) => (
            <li key={step.title} className="rounded-md border p-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
                <span className="text-sm font-semibold">{step.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
              {step.triggeringSmells && step.triggeringSmells.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {step.triggeringSmells.map((rule) => (
                    <Link key={rule} href={`/smells#${rule}`}>
                      <Badge variant="outline" className="font-mono text-[10px] hover:bg-accent">
                        {rule}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </Section>

      {metric.thresholdsUsed.length > 0 ? (
        <Section title="Thresholds in use">
          <ul className="space-y-1">
            {metric.thresholdsUsed.map((t) => (
              <li key={t.name} className="text-xs">
                <span className="font-mono">{t.name}</span>
                <span className="text-muted-foreground"> = </span>
                <span className="font-mono">{t.value}</span>
                <span className="text-muted-foreground"> — {t.description}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {metric.relatedSmells.length > 0 ? (
        <Section title="Related smells">
          <div className="flex flex-wrap gap-1.5">
            {metric.relatedSmells.map((rule) => (
              <Link key={rule} href={`/smells#${rule}`}>
                <Badge variant="secondary" className="font-mono text-[10px] hover:bg-accent">
                  {rule}
                </Badge>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
