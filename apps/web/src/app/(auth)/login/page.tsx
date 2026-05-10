import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInWithGitHubButton } from '@/components/auth/sign-in-button';

interface PageProps {
  searchParams?: { reauth?: string };
}

export default function LoginPage({ searchParams }: PageProps) {
  const reauth = searchParams?.reauth === '1';

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in to Archlens</CardTitle>
          <CardDescription>
            {reauth
              ? 'Your session expired. Please sign in again.'
              : 'Connect your GitHub account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <SignInWithGitHubButton size="lg" />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
