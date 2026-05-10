import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { AppConfig } from '../config/config.types';
import { SCAN_QUEUE_NAME } from './queue.constants';
import { QueueService, SCAN_QUEUE_TOKEN } from './queue.service';

const scanQueueProvider: Provider = {
  provide: SCAN_QUEUE_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): Queue => {
    const url = config.get('REDIS_URL', { infer: true });
    const connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    return new Queue(SCAN_QUEUE_NAME, { connection });
  },
};

@Global()
@Module({
  providers: [scanQueueProvider, QueueService],
  exports: [QueueService],
})
export class QueueModule {}
