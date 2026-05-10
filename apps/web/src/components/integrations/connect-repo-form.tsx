'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { createRepo } from '@/lib/api/repos';
import { useAuthToken } from '@/hooks/use-auth-token';

export function ConnectRepoForm() {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setError('Not signed in');
      return;
    }
    setError(null);
    setOkMessage(null);
    setSubmitting(true);
    try {
      const repo = await createRepo(token, {
        owner: owner.trim(),
        name: name.trim(),
        defaultBranch: defaultBranch.trim() || 'main',
        private: isPrivate,
      });
      void queryClient.invalidateQueries();
      setOkMessage(`Connected ${repo.fullName}`);
      router.refresh();
      // Navigate after a brief moment so the user sees the confirmation.
      setTimeout(() => router.push(`/repos/${repo.owner}/${repo.name}`), 600);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) setError('This repository is already connected.');
        else if (e.status === 401) setError('Session expired. Please sign in again.');
        else setError(`API ${e.status}: ${e.statusText}`);
      } else {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card data-testid="connect-repo-form">
      <CardHeader>
        <CardTitle className="text-lg">Connect a GitHub repository</CardTitle>
        <CardDescription>
          Paste the owner and name of a GitHub repo you want Archlens to analyze.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Owner</span>
              <input
                data-testid="connect-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="octocat"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                data-testid="connect-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="hello-world"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Default branch</span>
              <input
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
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
              data-testid="connect-error"
            >
              {error}
            </div>
          )}
          {okMessage && (
            <div
              className="rounded-md border border-grade-a/40 bg-grade-a/10 px-3 py-2 text-sm"
              data-testid="connect-success"
            >
              {okMessage}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} data-testid="connect-submit">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                'Connect repository'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
