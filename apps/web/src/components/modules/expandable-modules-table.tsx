'use client';

import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type {
  ReportModuleDetailDto,
  ReportModuleScoreDto,
  Severity,
  Smell,
} from '@archlens/shared-types';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GradeBadge } from '@/components/score/grade-badge';
import { scoreToGrade } from '@/lib/utils/grade';
import { formatScore, formatRatio, formatOptionalInt } from '@/lib/utils/format';
import { classifyModuleShape } from '@/lib/utils/module-shape';
import { useAuthToken } from '@/hooks/use-auth-token';
import { getReportModule } from '@/lib/api/reports';

interface ExpandableModulesTableProps {
  scanId: string;
  modules: ReportModuleScoreDto[];
}

interface DetailState {
  loading: boolean;
  detail?: ReportModuleDetailDto;
  error?: string;
}

export function ExpandableModulesTable({ scanId, modules }: ExpandableModulesTableProps) {
  const token = useAuthToken();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailState>>({});

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

  const primary = modules.filter((m) => m.fileCount > 1);
  const small = modules.filter((m) => m.fileCount <= 1);
  const showDMain = primary.some((m) => m.martinDistance !== undefined);

  const toggle = async (moduleId: string): Promise<void> => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
    // Fetch on first open. Already-loaded details stay cached.
    if (!moduleId) return;
    if (expanded.has(moduleId)) return;
    if (details[moduleId]?.detail || details[moduleId]?.loading) return;
    setDetails((prev) => ({ ...prev, [moduleId]: { loading: true } }));
    try {
      const detail = await getReportModule(token, scanId, moduleId);
      setDetails((prev) => ({ ...prev, [moduleId]: { loading: false, detail } }));
    } catch (e) {
      setDetails((prev) => ({
        ...prev,
        [moduleId]: { loading: false, error: e instanceof Error ? e.message : 'Failed to load' },
      }));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
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
              const isOpen = expanded.has(m.id);
              const overall = m.scoreBreakdown?.overall;
              const grade = scoreToGrade(
                overall ?? Math.max(0, 100 - m.avgComplexity * 5 - m.smellCount * 2)
              );
              const shape = classifyModuleShape(m);
              const detailState = details[m.id];
              const colSpan = showDMain ? 12 : 11;

              return (
                <Fragment key={m.id}>
                  <TableRow
                    data-testid="module-row"
                    onClick={() => void toggle(m.id)}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell className="text-muted-foreground">
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      />
                    </TableCell>
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

                  {isOpen ? (
                    <TableRow data-testid="module-detail">
                      <TableCell colSpan={colSpan} className="bg-muted/20 p-4">
                        <ModuleDetailPanel module={m} state={detailState} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
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

function ModuleDetailPanel({
  module,
  state,
}: {
  module: ReportModuleScoreDto;
  state: DetailState | undefined;
}) {
  const sb = module.scoreBreakdown;
  return (
    <div className="space-y-4">
      {sb ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <ModuleScoreChip
            label="Complexity"
            score={sb.complexity}
            note={sb.measurementNotes?.complexity}
            derivation={sb.derivation?.complexity}
          />
          <ModuleScoreChip
            label="Duplication"
            score={sb.duplication}
            note={sb.measurementNotes?.duplication}
            derivation={sb.derivation?.duplication}
          />
          <ModuleScoreChip
            label="Coupling"
            score={sb.coupling}
            note={sb.measurementNotes?.coupling}
            derivation={sb.derivation?.coupling}
          />
          <ModuleScoreChip
            label="Cohesion"
            score={sb.cohesion}
            note={sb.measurementNotes?.cohesion}
            derivation={sb.derivation?.cohesion}
          />
          <ModuleScoreChip
            label="Smells"
            score={sb.smells}
            note={sb.measurementNotes?.smells}
            derivation={sb.derivation?.smells}
          />
        </div>
      ) : null}

      {!state || state.loading ? (
        <div className="text-sm text-muted-foreground">Loading module details…</div>
      ) : state.error ? (
        <div className="text-sm text-red-600">Could not load details: {state.error}</div>
      ) : state.detail ? (
        <>
          <FilesSection detail={state.detail} />
          <SmellsSection smells={state.detail.smells} />
        </>
      ) : null}
    </div>
  );
}

function ModuleScoreChip({
  label,
  score,
  note,
  derivation,
}: {
  label: string;
  score: number;
  note?: string;
  derivation?: string;
}) {
  const grade = scoreToGrade(score);
  const titleText = derivation ? (note ? `${derivation}\n\nNote: ${note}` : derivation) : note;
  return (
    <div
      className="rounded-md border bg-background p-2"
      title={titleText}
      data-testid="module-score-chip"
      data-label={label}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-base font-semibold">{formatScore(score)}</div>
        </div>
        <GradeBadge grade={grade} size="sm" />
      </div>
    </div>
  );
}

function FilesSection({ detail }: { detail: ReportModuleDetailDto }) {
  if (detail.files.length === 0) {
    return <div className="text-sm text-muted-foreground">No files in this module.</div>;
  }
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Files
      </h4>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Path</TableHead>
              <TableHead className="text-right">LOC</TableHead>
              <TableHead className="text-right">Complexity</TableHead>
              <TableHead className="text-right">Smells</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.files.map((f) => (
              <TableRow key={f.irFileId}>
                <TableCell className="font-mono text-xs">{f.path}</TableCell>
                <TableCell className="text-right">{f.loc}</TableCell>
                <TableCell className="text-right">{f.complexity}</TableCell>
                <TableCell className="text-right">{f.smellCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function SmellsSection({ smells }: { smells: Smell[] }) {
  if (smells.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No smells in this module. <span aria-hidden>✨</span>
      </div>
    );
  }
  const grouped: Record<Severity, Smell[]> = {
    critical: [],
    major: [],
    minor: [],
    info: [],
  };
  for (const s of smells) grouped[s.severity].push(s);

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Smells in this module ({smells.length})
      </h4>
      <div className="space-y-3">
        {(['critical', 'major', 'minor', 'info'] as Severity[]).map((sev) =>
          grouped[sev].length > 0 ? (
            <div key={sev}>
              <div className="mb-1 flex items-center gap-2">
                <SeverityChip severity={sev} />
                <span className="text-xs text-muted-foreground">
                  {grouped[sev].length} finding{grouped[sev].length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="space-y-1 text-sm">
                {grouped[sev].map((s) => (
                  <li key={s.id} className="rounded border bg-background px-3 py-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{s.ruleId}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.file}
                        {s.location ? `:${s.location.startLine}` : ''}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.message}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  const color: Record<Severity, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    major: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    minor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color[severity]}`}
    >
      {severity}
    </span>
  );
}
