'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { FixSuggestionDto } from '@archlens/shared-types';
import { useAuthToken } from '@/hooks/use-auth-token';
import { requestSmellFixSuggestion } from '@/lib/api/reports';
import { ApiError } from '@/lib/api/client';

interface SmellFixSuggestionProps {
  scanId: string;
  smellId: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: FixSuggestionDto }
  | { kind: 'error'; message: string; status?: number };

export function SmellFixSuggestion({ scanId, smellId }: SmellFixSuggestionProps) {
  const token = useAuthToken();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const run = async (force: boolean): Promise<void> => {
    setState({ kind: 'loading' });
    try {
      const data = await requestSmellFixSuggestion(token, scanId, smellId, { force });
      setState({ kind: 'ready', data });
    } catch (err) {
      if (err instanceof ApiError) {
        setState({
          kind: 'error',
          message: friendlyMessage(err),
          status: err.status,
        });
      } else {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load suggestion',
        });
      }
    }
  };

  if (state.kind === 'idle') {
    return (
      <button
        type="button"
        onClick={() => void run(false)}
        className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted/60"
        data-testid="suggest-fix-button"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Suggest fix
      </button>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        Asking the model…
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="space-y-2 rounded-md border border-red-200 bg-red-50/40 p-3 text-xs dark:border-red-900/40 dark:bg-red-950/20">
        <div className="font-medium text-red-700 dark:text-red-300">
          Couldn&apos;t generate a suggestion
        </div>
        <div className="text-red-700/80 dark:text-red-300/80">{state.message}</div>
        <button
          type="button"
          onClick={() => void run(false)}
          className="inline-flex items-center gap-1.5 rounded border bg-background px-2 py-0.5 text-[11px] hover:bg-muted/60"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      </div>
    );
  }

  const { data } = state;
  return (
    <div
      className="space-y-2 rounded-md border bg-background p-3 text-sm"
      data-testid="fix-suggestion"
    >
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          {data.model}
          {data.cached ? <span className="rounded bg-muted px-1.5 py-0.5">cached</span> : null}
        </span>
        <button
          type="button"
          onClick={() => void run(true)}
          className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 hover:bg-muted/60"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </button>
      </div>
      <div className="fix-md text-sm leading-6">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => (
              <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
            ),
            h1: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
            h2: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
            h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            code: ({
              inline,
              children,
              ...rest
            }: {
              inline?: boolean;
              children?: React.ReactNode;
            }) =>
              inline ? (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]" {...rest}>
                  {children}
                </code>
              ) : (
                <code className="font-mono text-[12px]" {...rest}>
                  {children}
                </code>
              ),
            pre: ({ children }) => (
              <pre className="mb-2 overflow-auto rounded-md bg-muted p-3 text-[12px] last:mb-0">
                {children}
              </pre>
            ),
          }}
        >
          {data.contentMarkdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function friendlyMessage(err: ApiError): string {
  if (err.status === 503) {
    return 'LLM is not configured on the server. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.';
  }
  if (err.status === 404) {
    return 'Source is not available for this smell. Re-run the scan so the worker captures source.';
  }
  if (err.status === 502) {
    return 'The model service returned an error. Try regenerating in a moment.';
  }
  return err.message;
}
