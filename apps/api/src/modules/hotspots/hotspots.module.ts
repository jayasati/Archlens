import { Module } from '@nestjs/common';
import { HotspotsController } from './hotspots.controller';
import { HotspotsService } from './hotspots.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [HotspotsController],
  providers: [HotspotsService],
})
export class HotspotsModule {}
