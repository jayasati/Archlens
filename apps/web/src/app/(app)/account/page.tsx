import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { getMeServer } from '@/lib/api/users';
import { getSessionToken } from '@/lib/auth/server';

export default async function AccountPage() {
  const token = await getSessionToken();
  if (!token) redirect('/login');

  let user;
  try {
    user = await getMeServer(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect('/login?reauth=1');
    throw e;
  }

  return (
    <div className="space-y-6" data-testid="account-page">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Your Archlens profile, sourced from <code>GET /users/me</code>.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name ?? user.githubUsername ?? 'avatar'}
              className="h-14 w-14 rounded-full border"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-lg font-semibold">
              {(user.name ?? user.githubUsername ?? '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <CardTitle>{user.name ?? user.githubUsername ?? 'Unnamed user'}</CardTitle>
            <CardDescription>{user.email ?? 'No email on file'}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-y-2 text-sm md:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono text-xs" data-testid="account-user-id">
              {user.id}
            </dd>
            <dt className="text-muted-foreground">GitHub username</dt>
            <dd>{user.githubUsername ?? '—'}</dd>
            <dt className="text-muted-foreground">Connected since</dt>
            <dd suppressHydrationWarning>{new Date(user.createdAt).toLocaleString()}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
