import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtPayload, RepositoryDto } from '@archlens/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RepositoriesService } from './repositories.service';
import { createRepositorySchema, type CreateRepositoryInput } from './dto/create-repository.schema';

@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly repos: RepositoriesService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload | undefined,
    @Body(new ZodValidationPipe(createRepositorySchema)) body: CreateRepositoryInput
  ): Promise<RepositoryDto> {
    if (!user) throw new UnauthorizedException();
    return this.repos.create(user.sub, body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload | undefined): Promise<RepositoryDto[]> {
    if (!user) throw new UnauthorizedException();
    return this.repos.list(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<RepositoryDto> {
    if (!user) throw new UnauthorizedException();
    return this.repos.findOne(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    await this.repos.remove(user.sub, id);
  }
}
