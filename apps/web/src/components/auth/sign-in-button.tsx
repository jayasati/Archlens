'use client';

import { Github } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/constants';

interface Props extends Omit<ButtonProps, 'onClick'> {
  callbackUrl?: string;
}

export function SignInWithGitHubButton({ size = 'default', variant = 'default', ...rest }: Props) {
  const href = `${API_BASE_URL}/auth/github`;
  return (
    <Button
      data-testid="sign-in-github"
      size={size}
      variant={variant}
      onClick={() => {
        window.location.href = href;
      }}
      {...rest}
    >
      <Github className="mr-2 h-4 w-4" />
      Sign in with GitHub
    </Button>
  );
}
