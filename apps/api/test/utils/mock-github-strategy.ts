import { Injectable } from '@nestjs/common';
import passport from 'passport';

export const MOCK_GITHUB_PROFILE = {
  providerAccountId: 'gh-1234567',
  username: 'mockuser',
  email: 'mock@example.com',
  name: 'Mock User',
  avatarUrl: 'https://example.com/mock.png',
  accessToken: 'gh_mock_access_token',
};

class TestGithubStrategy {
  name = 'github';
  declare success: (user: unknown, info?: unknown) => void;
  declare fail: (challenge?: unknown, status?: number) => void;
  declare error: (err: unknown) => void;
  declare redirect: (url: string, status?: number) => void;

  authenticate(): void {
    this.success({ ...MOCK_GITHUB_PROFILE });
  }
}

@Injectable()
export class MockGithubStrategyProvider {
  constructor() {
    try {
      (passport as unknown as { unuse: (name: string) => void }).unuse('github');
    } catch {
      // ignore if not previously registered
    }
    passport.use('github', new TestGithubStrategy() as unknown as passport.Strategy);
  }
}
