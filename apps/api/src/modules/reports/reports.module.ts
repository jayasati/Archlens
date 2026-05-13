import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { IrLoader } from './ir-loader';
import { SourceLoader } from './source-loader';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, IrLoader, SourceLoader],
  exports: [ReportsService, IrLoader, SourceLoader],
})
export class ReportsModule {}
