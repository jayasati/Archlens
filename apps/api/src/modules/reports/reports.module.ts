import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { IrLoader } from './ir-loader';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, IrLoader],
  exports: [ReportsService, IrLoader],
})
export class ReportsModule {}
