import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import type { Provider } from '@nestjs/common';
import type { AppConfig } from '../../config/config.types';

export const REDIS_SUB_TOKEN = 'SCANS_REDIS_SUB';

export const redisSubscriberProvider: Provider = {
  provide: REDIS_SUB_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): IORedis => {
    const url = config.get('REDIS_URL', { infer: true });
    return new IORedis(url, { maxRetriesPerRequest: null, lazyConnect: false });
  },
};
