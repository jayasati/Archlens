import { Inject, Injectable, Logger } from '@nestjs/common';
import type IORedis from 'ioredis';
import { SCAN_EVENTS, type ScanEvent } from '@archlens/shared-types';

export const REDIS_PUB_TOKEN = 'PROGRESS_REDIS_PUB';

const channel = (scanId: string): string => `archlens:scan:${scanId}`;

@Injectable()
export class ProgressPublisher {
  private readonly logger = new Logger(ProgressPublisher.name);

  constructor(@Inject(REDIS_PUB_TOKEN) private readonly redis: IORedis) {}

  async started(scanId: string): Promise<void> {
    await this.publish({
      type: SCAN_EVENTS.Started,
      scanId,
      at: new Date().toISOString(),
    });
  }

  async progress(scanId: string, step: string, percent: number, message?: string): Promise<void> {
    await this.publish({
      type: SCAN_EVENTS.Progress,
      scanId,
      step,
      percent,
      ...(message ? { message } : {}),
      at: new Date().toISOString(),
    });
  }

  async completed(scanId: string, reportId: string): Promise<void> {
    await this.publish({
      type: SCAN_EVENTS.Completed,
      scanId,
      reportId,
      at: new Date().toISOString(),
    });
  }

  async failed(scanId: string, error: string): Promise<void> {
    await this.publish({
      type: SCAN_EVENTS.Failed,
      scanId,
      error,
      at: new Date().toISOString(),
    });
  }

  private async publish(event: ScanEvent): Promise<void> {
    try {
      await this.redis.publish(channel(event.scanId), JSON.stringify(event));
    } catch (err) {
      this.logger.warn(`Failed to publish progress for ${event.scanId}: ${(err as Error).message}`);
    }
  }
}
