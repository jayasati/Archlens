import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from './options';

export async function getSessionToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.archlensAccessToken ?? null;
}

export async function requireSessionToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) throw new Error('Unauthorized: no Archlens access token in session');
  return token;
}
