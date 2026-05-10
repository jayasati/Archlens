import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HotspotsView } from '@/components/hotspots/hotspots-view';
import { getSessionToken } from '@/lib/auth/server';
import { ApiError } from '@/lib/api/client';
import { findRepoByOwnerAndName } from '@/lib/api/repos';
import { listScansServer } from '@/lib/api/scans';

interface PageProps {
  params: { owner: string; name: string };
}

export default async function HotspotsPage({ params }: PageProps) {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  try {
    const repo = await findRepoByOwnerAndName(token, params.owner, params.name);
    if (!repo) notFound();

    const scans = await listScansServer(token, repo.id);
    const completed = scans
      .filter((s) => s.status === 'completed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

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
