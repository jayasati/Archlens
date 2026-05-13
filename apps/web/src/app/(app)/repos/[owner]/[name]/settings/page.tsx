import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { getSessionToken } from '@/lib/auth/server';
import { loadRepoContext } from '@/lib/api/repo-loader';
import { EditRepoForm } from '@/components/integrations/edit-repo-form';

interface PageProps {
  params: { owner: string; name: string };
}

export default async function RepoSettingsPage({ params }: PageProps) {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  let ctx;
  try {
    ctx = await loadRepoContext(token, params.owner, params.name);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect('/login?reauth=1');
    throw e;
  }
  if (!ctx) notFound();

  return <EditRepoForm repo={ctx.repo} />;
}
