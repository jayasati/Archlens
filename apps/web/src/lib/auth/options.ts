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
}

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

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET ?? '',
      authorization: { params: { scope: 'read:user user:email repo' } },
    }),
    // Used by the /callback page after the API's own OAuth redirect:
    // the API places ?accessToken=...&refreshToken=... on the URL,
    // which we then sign in with via this provider.
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

      if (user && 'archlensAccessToken' in user && user.archlensAccessToken) {
        token.archlens = {
          accessToken: user.archlensAccessToken as string,
          refreshToken: user.archlensRefreshToken as string,
          expiresAt: Date.now() + 15 * 60 * 1000,
        };
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as JWT & { archlens?: ArchlensTokens };
      if (t.archlens) {
        (session as Session & { archlensAccessToken?: string }).archlensAccessToken =
          t.archlens.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
