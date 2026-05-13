'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { RepositoryDto } from '@archlens/shared-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { deleteRepo, updateRepo } from '@/lib/api/repos';
import { useAuthToken } from '@/hooks/use-auth-token';

interface Props {
  repo: RepositoryDto;
}

export function EditRepoForm({ repo }: Props) {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [defaultBranch, setDefaultBranch] = useState(repo.defaultBranch);
  const [isPrivate, setIsPrivate] = useState(repo.private);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const dirty = defaultBranch.trim() !== repo.defaultBranch || isPrivate !== repo.private;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setError('Not signed in');
      return;
    }
    const trimmed = defaultBranch.trim();
    if (!trimmed) {
      setError('Default branch cannot be empty.');
      return;
    }
    setError(null);
    setOkMessage(null);
    setSaving(true);
    try {
      await updateRepo(token, repo.id, { defaultBranch: trimmed, private: isPrivate });
      void queryClient.invalidateQueries();
      setOkMessage('Settings saved. Re-scan to pick up the new branch.');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError('Session expired. Please sign in again.');
        else if (e.status === 404) setError('Repository not found.');
        else setError(`API ${e.status}: ${e.statusText}`);
      } else {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!token) {
      setError('Not signed in');
      return;
    }
    const ok = window.confirm(
      `Disconnect ${repo.fullName}? This deletes all scans and reports for this repository. ` +
        `You can re-connect it later.`
    );
    if (!ok) return;
    setError(null);
    setOkMessage(null);
    setDisconnecting(true);
    try {
      await deleteRepo(token, repo.id);
      void queryClient.invalidateQueries();
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError('Session expired. Please sign in again.');
        else if (e.status === 404) setError('Repository already removed.');
        else setError(`API ${e.status}: ${e.statusText}`);
      } else {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="edit-repo-form">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Repository settings</CardTitle>
          <CardDescription>
            Change which branch Archlens analyzes and whether the repository is treated as private.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Default branch</span>
                <input
                  data-testid="edit-default-branch"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  placeholder="main"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="block text-xs text-muted-foreground">
                  Currently {repo.defaultBranch}. Match this to the repo&apos;s real default branch
                  (often <code>main</code> or <code>master</code>) — the scanner clones this ref.
                </span>
              </label>
              <label className="flex items-end gap-2 pb-1">
                <input
                  data-testid="edit-private"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">Private repository</span>
              </label>
            </div>

            {error && (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="edit-error"
              >
                {error}
              </div>
            )}
            {okMessage && (
              <div
                className="rounded-md border border-grade-a/40 bg-grade-a/10 px-3 py-2 text-sm"
                data-testid="edit-success"
              >
                {okMessage}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !dirty} data-testid="edit-submit">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Disconnecting removes this repository from Archlens along with every scan, report, and
            fix suggestion. The source repo on GitHub is not affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDisconnect}
            disabled={disconnecting}
            data-testid="disconnect-repo"
          >
            {disconnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Disconnecting…
              </>
            ) : (
              'Disconnect repository'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
