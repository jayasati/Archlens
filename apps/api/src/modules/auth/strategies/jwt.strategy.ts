import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@archlens/shared-types';
import type { AppConfig } from '../../../config/config.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  validate(payload: unknown): JwtPayload {
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as { sub?: unknown }).sub !== 'string'
    ) {
      throw new UnauthorizedException('Invalid token payload');
    }
    const p = payload as Record<string, unknown>;
    return {
      sub: p.sub as string,
      email: typeof p.email === 'string' ? p.email : null,
      githubUsername: typeof p.githubUsername === 'string' ? p.githubUsername : null,
    };
  }
}
