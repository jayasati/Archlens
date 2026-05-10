import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { AppConfig } from '../../../config/config.types';

describe('JwtStrategy', () => {
  function build(): JwtStrategy {
    const config = {
      get: (key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-secret-test-secret-test-secret';
        return undefined;
      },
    } as unknown as ConfigService<AppConfig, true>;
    return new JwtStrategy(config);
  }

  it('returns a JwtPayload for a well-formed payload', () => {
    const strat = build();
    const result = strat.validate({
      sub: 'user-1',
      email: 'a@b.com',
      githubUsername: 'octocat',
    });
    expect(result).toEqual({
      sub: 'user-1',
      email: 'a@b.com',
      githubUsername: 'octocat',
    });
  });

  it('coerces missing optional fields to null', () => {
    const strat = build();
    const result = strat.validate({ sub: 'user-2' });
    expect(result).toEqual({
      sub: 'user-2',
      email: null,
      githubUsername: null,
    });
  });

  it('throws Unauthorized on missing sub', () => {
    const strat = build();
    expect(() => strat.validate({ email: 'x@y.z' })).toThrow(UnauthorizedException);
  });

  it('throws Unauthorized on non-object payload', () => {
    const strat = build();
    expect(() => strat.validate(null)).toThrow(UnauthorizedException);
    expect(() => strat.validate('string')).toThrow(UnauthorizedException);
  });
});
