import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GitHubProvider, { type GithubProfile } from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { AuthTokensDto } from '@archlens/shared-types';
import { SERVER_API_BASE_URL } from '../constants';

interface ArchlensTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  error?: 'RefreshFailed';
}

/**
 * Refresh window: try to refresh once we are within this many ms of expiry,
 * so a request landing right at the boundary doesn't fail with 401.
 */
const REFRESH_LEAD_MS = 30_000;

async function exchangeGithubForArchlensTokens(
  githubAccessToken: string,
  profile: GithubProfile
): Promise<AuthTokensDto> {
  const res = await fetch(`${SERVER_API_BASE_URL}/auth/github/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accessToken: githubAccessToken,
      providerAccountId: String(profile.id),
      username: profile.login ?? null,
      email: profile.email ?? null,
      name: profile.name ?? null,
      avatarUrl: profile.avatar_url ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AuthTokensDto;
}

async function refreshArchlensTokens(refreshToken: string): Promise<AuthTokensDto> {
  const res = await fetch(`${SERVER_API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  return (await res.json()) as AuthTokensDto;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET ?? '',
      authorization: { params: { scope: 'read:user user:email repo' } },
    }),
    // Used by the /auth/callback page after the API's own OAuth redirect:
    // the API places ?accessToken=...&refreshToken=... on the URL,
    // which we sign in with via this provider.
    CredentialsProvider({
      id: 'archlens-tokens',
      name: 'Archlens API tokens',
      credentials: {
        accessToken: { label: 'accessToken', type: 'text' },
        refreshToken: { label: 'refreshToken', type: 'text' },
      },
      async authorize(creds) {
        if (!creds?.accessToken || !creds.refreshToken) return null;
        return {
          id: 'archlens-user',
          archlensAccessToken: creds.accessToken,
          archlensRefreshToken: creds.refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // First-time sign-in via NextAuth GitHub provider.
      if (account?.provider === 'github' && account.access_token && profile) {
        try {
          const tokens = await exchangeGithubForArchlensTokens(
            account.access_token,
            profile as GithubProfile
          );
          token.archlens = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: Date.now() + tokens.expiresIn * 1000,
          };
        } catch (err) {
          console.error('Failed to exchange GitHub token for Archlens JWT:', err);
        }
      }

      // First-time sign-in via /auth/callback credentials provider.
      if (user && 'archlensAccessToken' in user && user.archlensAccessToken) {
        token.archlens = {
          accessToken: user.archlensAccessToken as string,
          refreshToken: user.archlensRefreshToken as string,
          // The credentials provider doesn't carry the expiresIn, so we use
          // the API's documented default of 15 minutes (JWT_ACCESS_TTL=900).
          expiresAt: Date.now() + 15 * 60 * 1000,
        };
      }

      // Refresh the access token if it's near expiry. Runs on every page
      // request (jwt callback fires whenever the session is read).
      const t = token as JWT & { archlens?: ArchlensTokens };
      if (t.archlens && !t.archlens.error) {
        const remaining = t.archlens.expiresAt - Date.now();
        if (remaining < REFRESH_LEAD_MS) {
          try {
            const fresh = await refreshArchlensTokens(t.archlens.refreshToken);
            t.archlens = {
              accessToken: fresh.accessToken,
              refreshToken: fresh.refreshToken,
              expiresAt: Date.now() + fresh.expiresIn * 1000,
            };
          } catch (err) {
            console.error('Failed to refresh Archlens token:', err);
            // Mark the session as broken so the next request goes to /login.
            t.archlens = { ...t.archlens, error: 'RefreshFailed' };
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as JWT & { archlens?: ArchlensTokens };
      if (t.archlens && !t.archlens.error) {
        (session as Session & { archlensAccessToken?: string }).archlensAccessToken =
          t.archlens.accessToken;
      } else if (t.archlens?.error) {
        (session as Session & { error?: string }).error = t.archlens.error;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
