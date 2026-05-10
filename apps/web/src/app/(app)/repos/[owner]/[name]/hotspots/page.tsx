import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HotspotsView } from '@/components/hotspots/hotspots-view';
import { getSessionToken } from '@/lib/auth/server';
import { ApiError } from '@/lib/api/client';
import { latestCompletedScan, loadRepoContext } from '@/lib/api/repo-loader';

interface PageProps {
  params: { owner: string; name: string };
}

export default async function HotspotsPage({ params }: PageProps) {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  try {
    const ctx = await loadRepoContext(token, params.owner, params.name);
    if (!ctx) notFound();

    const completed = latestCompletedScan(ctx.scans);

    if (!completed) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>No completed scan yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Run a scan to see this repository&apos;s hotspots.
            </p>
          </CardContent>
        </Card>
      );
    }

    return <HotspotsView scanId={completed.id} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect('/login?reauth=1');
    throw e;
  }
}
