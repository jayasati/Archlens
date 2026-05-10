import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokensDto, JwtPayload } from '@archlens/shared-types';

import type { AppConfig } from '../../config/config.types';
import { PrismaService } from '../../database/prisma.service';
import type { GithubProfilePayload } from './strategies/github.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>
  ) {}

  async loginWithGithub(profile: GithubProfilePayload): Promise<AuthTokensDto> {
    const provider = 'github';

    const existing = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    let userId: string;
    if (existing) {
      userId = existing.userId;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: profile.email ?? undefined,
          name: profile.name ?? undefined,
          avatarUrl: profile.avatarUrl ?? undefined,
          githubUsername: profile.username ?? undefined,
        },
      });
      await this.prisma.account.update({
        where: { id: existing.id },
        data: { accessToken: profile.accessToken },
      });
    } else {
      const created = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          githubUsername: profile.username,
          accounts: {
            create: {
              provider,
              providerAccountId: profile.providerAccountId,
              accessToken: profile.accessToken,
            },
          },
        },
      });
      userId = created.id;
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      githubUsername: user.githubUsername,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      githubUsername: user.githubUsername,
    });
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokensDto> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: refreshTtl,
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }
}
