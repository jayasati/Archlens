import { Controller, Get, Param, ParseUUIDPipe, UnauthorizedException } from '@nestjs/common';
import type { HotspotDto, JwtPayload } from '@archlens/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HotspotsService } from './hotspots.service';

@Controller('hotspots')
export class HotspotsController {
  constructor(private readonly hotspots: HotspotsService) {}

  @Get(':scanId')
  get(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('scanId', new ParseUUIDPipe()) scanId: string
  ): Promise<HotspotDto[]> {
    if (!user) throw new UnauthorizedException();
    return this.hotspots.getHotspots(user.sub, scanId);
  }
}
