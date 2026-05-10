'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createScan } from '@/lib/api/scans';
import { ApiError } from '@/lib/api/client';
import { useAuthToken } from '@/hooks/use-auth-token';
import { useScanProgress } from '@/hooks/use-scan-progress';
import { cn } from '@/lib/utils/cn';

interface Props {
  repoId: string;
}

export function RescanButton({ repoId }: Props) {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scanId, setScanId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const progress = useScanProgress(scanId, {
    onCompleted: () => {
      // Refresh server-rendered pages and any TanStack Query caches.
      void queryClient.invalidateQueries();
      router.refresh();
    },
  });

  async function handleClick() {
    if (!token) {
      setSubmitError('Not signed in');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const scan = await createScan(token, repoId);
      setScanId(scan.id);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? `Failed to enqueue scan: ${err.status} ${err.statusText}`
          : err instanceof Error
            ? err.message
            : 'Failed to enqueue scan'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isRunning =
    submitting ||
    progress.status === 'connecting' ||
    progress.status === 'subscribed' ||
    (scanId !== null && progress.status !== 'completed' && progress.status !== 'failed');

  return (
    <div className="space-y-2" data-testid="rescan-controls">
      <div className="flex items-center justify-end">
        <Button
          data-testid="rescan-button"
          onClick={handleClick}
          disabled={isRunning}
          variant="default"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Re-scan
            </>
          )}
        </Button>
      </div>

      {submitError && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-3 text-sm text-destructive">{submitError}</CardContent>
        </Card>
      )}

      {scanId && progress.status !== 'idle' && <ProgressCard progress={progress} />}
    </div>
  );
}

function ProgressCard({ progress }: { progress: ReturnType<typeof useScanProgress> }) {
  const isDone = progress.status === 'completed';
  const isFailed = progress.status === 'failed' || progress.status === 'error';
  const pct = Math.max(0, Math.min(100, progress.percent));

  return (
    <Card data-testid="scan-progress" data-status={progress.status}>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-grade-a" />
            ) : isFailed ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <span className="font-medium" data-testid="scan-progress-step">
              {progress.step ?? statusLabel(progress.status)}
            </span>
            {progress.message && (
              <span className="text-muted-foreground">— {progress.message}</span>
            )}
          </div>
          <span
            className="font-mono text-xs text-muted-foreground"
            data-testid="scan-progress-percent"
          >
            {pct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full transition-all',
              isFailed ? 'bg-destructive' : isDone ? 'bg-grade-a' : 'bg-primary'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {progress.error && (
          <p className="text-xs text-destructive" data-testid="scan-progress-error">
            {progress.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'connecting':
      return 'Connecting…';
    case 'subscribed':
      return 'Waiting for worker…';
    case 'completed':
      return 'Done';
    case 'failed':
      return 'Failed';
    case 'error':
      return 'Connection error';
    default:
      return status;
  }
}
