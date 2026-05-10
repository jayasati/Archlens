import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignInWithGitHubButton } from '@/components/auth/sign-in-button';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GitBranch className="h-5 w-5" />
          Archlens
        </Link>
        <Button variant="ghost" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </header>
      <section className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight">
            Architecture-aware code analysis
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Score your repositories on complexity, coupling, smells, and architecture violations.
            Catch regressions on every PR.
          </p>
          <div className="mt-8 flex justify-center">
            <SignInWithGitHubButton size="lg" />
          </div>
        </div>
      </section>
    </main>
  );
}
