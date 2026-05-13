'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReportFileSourceDto, Severity } from '@archlens/shared-types';
import { useAuthToken } from '@/hooks/use-auth-token';
import { getReportFileSource } from '@/lib/api/reports';

interface FileSourceViewProps {
  scanId: string;
  fileId: string;
  focusStartLine?: number;
  focusEndLine?: number;
  /** ruleIds at each line, used to render gutter markers for every smell in the file. */
}

const SEVERITY_BG: Record<Severity, string> = {
  critical: 'bg-red-100 dark:bg-red-950/40',
  major: 'bg-orange-100 dark:bg-orange-950/40',
  minor: 'bg-amber-100 dark:bg-amber-950/40',
  info: 'bg-slate-100 dark:bg-slate-800/40',
};

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: 'border-l-red-500',
  major: 'border-l-orange-500',
  minor: 'border-l-amber-500',
  info: 'border-l-slate-400',
};

export function FileSourceView({
  scanId,
  fileId,
  focusStartLine,
  focusEndLine,
}: FileSourceViewProps) {
  const token = useAuthToken();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; data: ReportFileSourceDto }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getReportFileSource(token, scanId, fileId)
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', data });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: e instanceof Error ? e.message : 'Failed to load source',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, scanId, fileId]);

  if (state.kind === 'loading') {
    return <div className="px-3 py-6 text-sm text-muted-foreground">Loading source…</div>;
  }
  if (state.kind === 'error') {
    return (
      <div className="px-3 py-6 text-sm text-red-600">Could not load source: {state.message}</div>
    );
  }

  return (
    <FileSourceBody
      source={state.data}
      focusStartLine={focusStartLine}
      focusEndLine={focusEndLine}
    />
  );
}

function FileSourceBody({
  source,
  focusStartLine,
  focusEndLine,
}: {
  source: ReportFileSourceDto;
  focusStartLine?: number;
  focusEndLine?: number;
}) {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => source.content.split(/\r?\n/), [source.content]);

  /** Map of 1-indexed line number → strongest severity of any smell covering that line. */
  const severityByLine = useMemo(() => {
    const m = new Map<number, Severity>();
    const rank: Record<Severity, number> = { critical: 0, major: 1, minor: 2, info: 3 };
    for (const s of source.smells) {
      if (!s.location) continue;
      for (let ln = s.location.startLine; ln <= s.location.endLine; ln += 1) {
        const cur = m.get(ln);
        if (!cur || rank[s.severity] < rank[cur]) m.set(ln, s.severity);
      }
    }
    return m;
  }, [source.smells]);

  useEffect(() => {
    if (focusStartLine && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusStartLine, focusEndLine, source.irFileId]);

  const gutterWidth = Math.max(2, String(lines.length).length);

  return (
    <div className="overflow-hidden rounded-md border bg-background" data-testid="file-source-view">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs">
        <span className="font-mono text-muted-foreground">{source.path}</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span>{source.language}</span>
          {source.truncated ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              truncated
            </span>
          ) : null}
        </span>
      </div>
      <pre
        className="max-h-[60vh] overflow-auto bg-background p-0 font-mono text-xs leading-5"
        data-testid="file-source-pre"
      >
        {lines.map((text, idx) => {
          const ln = idx + 1;
          const severity = severityByLine.get(ln);
          const isFocus =
            focusStartLine !== undefined &&
            ln >= focusStartLine &&
            ln <= (focusEndLine ?? focusStartLine);
          const isFirstFocusLine = isFocus && ln === focusStartLine;
          return (
            <div
              key={ln}
              ref={isFirstFocusLine ? focusRef : undefined}
              className={`flex border-l-2 ${
                severity ? SEVERITY_BORDER[severity] : 'border-l-transparent'
              } ${severity ? SEVERITY_BG[severity] : ''} ${
                isFocus ? 'ring-1 ring-inset ring-primary/40' : ''
              }`}
              data-line={ln}
            >
              <span
                className="select-none whitespace-pre px-3 py-0 text-right text-muted-foreground"
                style={{ minWidth: `${gutterWidth + 2}ch` }}
              >
                {ln}
              </span>
              <span className="flex-1 whitespace-pre px-2 py-0">{text || ' '}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
