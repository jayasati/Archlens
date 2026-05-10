import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthTokensDto } from '@archlens/shared-types';

import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AppConfig } from '../../config/config.types';
import { AuthService } from './auth.service';
import type { GithubProfilePayload } from './strategies/github.strategy';
import { refreshTokenSchema, type RefreshTokenInput } from './dto/refresh-token.schema';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig, true>
  ) {}

  @Public()
  @UseGuards(AuthGuard('github'))
  @Get('github')
  githubLogin(): void {}

  @Public()
  @UseGuards(AuthGuard('github'))
  @Get('github/callback')
  async githubCallback(
    @Req() req: Request & { user?: GithubProfilePayload },
    @Res() res: Response
  ): Promise<void> {
    if (!req.user) throw new UnauthorizedException();

    const tokens = await this.authService.loginWithGithub(req.user);

    const webUrl = this.config.get('WEB_APP_URL', { infer: true });
    const wantsRedirect = (req.query?.redirect as string | undefined) !== 'false';

    if (wantsRedirect && webUrl) {
      const redirectTo = `${webUrl}/auth/callback?accessToken=${encodeURIComponent(
        tokens.accessToken
      )}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;
      res.redirect(redirectTo);
      return;
    }

    res.status(HttpStatus.OK).json(tokens);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput
  ): Promise<AuthTokensDto> {
    return this.authService.refresh(body.refreshToken);
  }
}
