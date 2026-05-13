import { Controller, Get, Param, ParseUUIDPipe, UnauthorizedException } from '@nestjs/common';
import type {
  JwtPayload,
  ReportFileDetailDto,
  ReportFileSourceDto,
  ReportModuleDetailDto,
  ReportModuleScoreDto,
  ReportSummaryDto,
} from '@archlens/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':scanId')
  getSummary(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('scanId', new ParseUUIDPipe()) scanId: string
  ): Promise<ReportSummaryDto> {
    if (!user) throw new UnauthorizedException();
    return this.reports.getSummary(user.sub, scanId);
  }

  @Get(':scanId/modules')
  listModules(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('scanId', new ParseUUIDPipe()) scanId: string
  ): Promise<ReportModuleScoreDto[]> {
    if (!user) throw new UnauthorizedException();
    return this.reports.listModules(user.sub, scanId);
  }

  @Get(':scanId/modules/:moduleId')
  getModule(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('scanId', new ParseUUIDPipe()) scanId: string,
    @Param('moduleId', new ParseUUIDPipe()) moduleId: string
  ): Promise<ReportModuleDetailDto> {
    if (!user) throw new UnauthorizedException();
    return this.reports.getModule(user.sub, scanId, moduleId);
  }

  @Get(':scanId/files/:fileId/source')
  getFileSource(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('scanId', new ParseUUIDPipe()) scanId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string
  ): Promise<ReportFileSourceDto> {
    if (!user) throw new UnauthorizedException();
    return this.reports.getFileSource(user.sub, scanId, fileId);
  }

  @Get(':scanId/files/:filePath')
  getFile(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('scanId', new ParseUUIDPipe()) scanId: string,
    @Param('filePath') filePath: string
  ): Promise<ReportFileDetailDto> {
    if (!user) throw new UnauthorizedException();
    return this.reports.getFile(user.sub, scanId, filePath);
  }
}
