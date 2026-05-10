import type { ReactNode } from 'react';
import type { UserDto } from '@archlens/shared-types';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ApiError } from '@/lib/api/client';
import { getMeServer } from '@/lib/api/users';
import { getSessionToken } from '@/lib/auth/server';

async function loadUser(): Promise<UserDto | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await getMeServer(token);
  } catch (e) {
    // 401 here is handled by individual pages (which redirect). The topbar
    // gracefully degrades to "Account" if /me fails.
    if (e instanceof ApiError) return null;
    return null;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await loadUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
