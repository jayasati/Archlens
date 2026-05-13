import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type { FixSuggestionDto, JwtPayload } from '@archlens/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FixSuggestionsService } from './fix-suggestions.service';

@Controller('reports')
export class FixSuggestionsController {
  constructor(private readonly service: FixSuggestionsService) {}

  @Post(':scanId/smells/:smellId/suggest-fix')
  suggest(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('scanId', new ParseUUIDPipe()) scanId: string,
    @Param('smellId') smellId: string,
    @Query('force') force?: string
  ): Promise<FixSuggestionDto> {
    if (!user) throw new UnauthorizedException();
    return this.service.suggest(user.sub, scanId, smellId, {
      force: force === 'true' || force === '1',
    });
  }
}
