import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-github2';
import type { AppConfig } from '../../../config/config.types';

export interface GithubProfilePayload {
  providerAccountId: string;
  username: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  accessToken: string;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      clientID: config.get('GITHUB_CLIENT_ID', { infer: true }),
      clientSecret: config.get('GITHUB_CLIENT_SECRET', { infer: true }),
      callbackURL: config.get('GITHUB_CALLBACK_URL', { infer: true }),
      scope: ['user:email', 'read:user', 'repo'],
    });
  }

  validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: unknown, user?: GithubProfilePayload) => void
  ): void {
    const primaryEmail =
      Array.isArray(profile.emails) && profile.emails.length > 0
        ? (profile.emails[0]?.value ?? null)
        : null;
    const avatar =
      Array.isArray(profile.photos) && profile.photos.length > 0
        ? (profile.photos[0]?.value ?? null)
        : null;

    const payload: GithubProfilePayload = {
      providerAccountId: profile.id,
      username: profile.username ?? null,
      email: primaryEmail,
      name: profile.displayName ?? null,
      avatarUrl: avatar,
      accessToken,
    };
    done(null, payload);
  }
}
