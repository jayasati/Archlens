import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { SCAN_QUEUE_NAME, type ScanJobData } from './queue.constants';

export const SCAN_QUEUE_TOKEN = 'BULLMQ_SCAN_QUEUE';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  constructor(@Inject(SCAN_QUEUE_TOKEN) private readonly scanQueue: Queue<ScanJobData>) {}

  async enqueueScan(data: ScanJobData): Promise<void> {
    await this.scanQueue.add(SCAN_QUEUE_NAME, data, {
      jobId: data.scanId,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
      attempts: 1,
    });
    this.logger.log(`enqueued scan ${data.scanId} for repo ${data.repoId}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.scanQueue.close();
  }
}
