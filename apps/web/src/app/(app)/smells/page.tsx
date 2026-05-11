import type { Severity } from '@archlens/ir-schema';
import type { SmellCategory, SmellDefinitionDto } from '@archlens/shared-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSmellCatalogServer } from '@/lib/api/smell-catalog';
import { cn } from '@/lib/utils/cn';

export const metadata = {
  title: 'Smell catalog · Archlens',
};

const CATEGORY_ORDER: ReadonlyArray<SmellCategory> = [
  'design',
  'size',
  'complexity',
  'duplication',
  'coupling',
  'cohesion',
];

const CATEGORY_LABELS: Record<SmellCategory, string> = {
  design: 'Design',
  size: 'Size',
  complexity: 'Complexity',
  duplication: 'Duplication',
  coupling: 'Coupling',
  cohesion: 'Cohesion',
};

const SEVERITY_TONE: Record<Severity, string> = {
  info: 'bg-muted text-muted-foreground',
  minor: 'bg-grade-c/15 text-grade-c',
  major: 'bg-grade-d/15 text-grade-d',
  critical: 'bg-destructive/15 text-destructive',
};

export default async function SmellsCatalogPage() {
  const rules = await getSmellCatalogServer().catch(() => [] as SmellDefinitionDto[]);

  const byCategory = new Map<SmellCategory, SmellDefinitionDto[]>();
  for (const r of rules) {
    const list = byCategory.get(r.category);
    if (list) list.push(r);
    else byCategory.set(r.category, [r]);
  }
  const orderedCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  return (
    <div className="space-y-8" data-testid="smells-catalog">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Smell catalog</h1>
        <p className="text-sm text-muted-foreground">
          Every code smell Archlens can currently detect. Add a definition in{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            packages/shared-types/src/domain/smell-catalog.ts
          </code>{' '}
          and ship a matching detector — this page picks it up automatically.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {rules.length} rule{rules.length === 1 ? '' : 's'} defined.
        </p>
      </header>

      {rules.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Catalog unavailable</CardTitle>
            <CardDescription>
              The Archlens API didn&apos;t return any rules. Make sure the API is running at{' '}
              <code>{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        orderedCategories.map((category) => (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {byCategory.get(category)!.map((rule) => (
                <SmellCard key={rule.ruleId} rule={rule} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function SmellCard({ rule }: { rule: SmellDefinitionDto }) {
  return (
    <Card data-testid="smell-card" data-rule-id={rule.ruleId}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{rule.name}</CardTitle>
            <CardDescription>{rule.shortDescription}</CardDescription>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              SEVERITY_TONE[rule.defaultSeverity]
            )}
          >
            {rule.defaultSeverity}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-mono text-[10px]">
            {rule.ruleId}
          </Badge>
          {rule.languages.map((lang) => (
            <Badge key={lang} variant="outline" className="text-[10px]">
              {lang}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{rule.description}</p>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            How to fix
          </p>
          <p className="mt-1 text-muted-foreground">{rule.remediation}</p>
        </div>

        {rule.thresholds && rule.thresholds.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Thresholds
            </p>
            <ul className="mt-1 space-y-1">
              {rule.thresholds.map((t) => (
                <li key={t.name} className="text-xs">
                  <span className="font-mono">{t.name}</span>
                  <span className="text-muted-foreground"> · default </span>
                  <span className="font-mono">{String(t.defaultValue)}</span>
                  <span className="text-muted-foreground"> — {t.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
