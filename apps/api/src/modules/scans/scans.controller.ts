import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtPayload, ScanDto } from '@archlens/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ScansService } from './scans.service';
import {
  createScanSchema,
  listScansQuerySchema,
  type CreateScanInput,
  type ListScansQuery,
} from './dto/create-scan.schema';

@Controller('scans')
export class ScansController {
  constructor(private readonly scans: ScansService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload | undefined,
    @Body(new ZodValidationPipe(createScanSchema)) body: CreateScanInput
  ): Promise<ScanDto> {
    if (!user) throw new UnauthorizedException();
    return this.scans.create(user.sub, body);
  }

  @Get()
  list(
    @CurrentUser() user: JwtPayload | undefined,
    @Query(new ZodValidationPipe(listScansQuerySchema)) query: ListScansQuery
  ): Promise<ScanDto[]> {
    if (!user) throw new UnauthorizedException();
    return this.scans.list(user.sub, query.repoId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<ScanDto> {
    if (!user) throw new UnauthorizedException();
    return this.scans.findOne(user.sub, id);
  }
}
