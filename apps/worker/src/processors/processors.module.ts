import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import type { WorkerConfig } from '../config/configuration';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ScanProcessor } from './scan.processor';
import { SCAN_QUEUE_CONNECTION } from './scan-queue.constants';

const queueConnectionProvider: Provider = {
  provide: SCAN_QUEUE_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService<WorkerConfig, true>): IORedis => {
    const url = config.get('REDIS_URL', { infer: true });
    return new IORedis(url, { maxRetriesPerRequest: null });
  },
};

@Module({
  imports: [PipelineModule],
  providers: [queueConnectionProvider, ScanProcessor],
  exports: [ScanProcessor],
})
export class ProcessorsModule {}
