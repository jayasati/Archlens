import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Worker, type Job } from 'bullmq';
import type { WorkerConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { ProgressPublisher } from '../progress/progress.publisher';
import { PipelineService } from '../pipeline/pipeline.service';
import { SCAN_QUEUE_CONNECTION, SCAN_QUEUE_NAME, type ScanJobData } from './scan-queue.constants';

@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);
  private worker?: Worker<ScanJobData>;

  constructor(
    @Inject(SCAN_QUEUE_CONNECTION) private readonly connection: IORedis,
    private readonly config: ConfigService<WorkerConfig, true>,
    private readonly prisma: PrismaService,
    private readonly pipeline: PipelineService,
    private readonly progress: ProgressPublisher
  ) {}

  onModuleInit(): void {
    const concurrency = this.config.get('WORKER_CONCURRENCY', { infer: true });
    this.worker = new Worker<ScanJobData>(SCAN_QUEUE_NAME, async (job) => this.handle(job), {
      connection: this.connection,
      concurrency,
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed`);
    });

    this.logger.log(
      `Scan worker listening on queue '${SCAN_QUEUE_NAME}' (concurrency=${concurrency})`
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job<ScanJobData>): Promise<void> {
    const { scanId, repoId, cloneUrl, ref } = job.data;
    this.logger.log(`Processing scan ${scanId} for repo ${repoId}`);

    await this.prisma.scan.update({
      where: { id: scanId },
      data: { status: 'running', startedAt: new Date(), progressStep: '01-clone', progressPct: 0 },
    });

    try {
      await this.pipeline.run({ scanId, repoId, cloneUrl, ref }, async (step, percent) => {
        await this.prisma.scan.update({
          where: { id: scanId },
          data: { progressStep: step, progressPct: percent },
        });
      });

      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          progressPct: 100,
          progressStep: '08-persist',
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Scan ${scanId} failed: ${message}`);
      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: message,
        },
      });
      await this.progress.failed(scanId, message);
      throw err;
    }
  }
}
