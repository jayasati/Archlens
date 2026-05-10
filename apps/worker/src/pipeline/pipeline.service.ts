import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WorkerConfig } from '../config/configuration';
import { ProgressPublisher } from '../progress/progress.publisher';
import { CloneStep } from './steps/01-clone.step';
import { DetectLanguagesStep } from './steps/02-detect-languages.step';
import { RunAdaptersStep } from './steps/03-run-adapters.step';
import { ComputeMetricsStep } from './steps/04-compute-metrics.step';
import { BuildGraphStep } from './steps/05-build-graph.step';
import { ScoreStep } from './steps/06-score.step';
import { RenderDiagramsStep } from './steps/07-render-diagrams.step';
import { PersistStep } from './steps/08-persist.step';
import type {
  PipelineContext,
  PipelineInput,
  PipelineResult,
  ProgressReporter,
} from './pipeline.types';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly config: ConfigService<WorkerConfig, true>,
    private readonly progress: ProgressPublisher,
    private readonly cloneStep: CloneStep,
    private readonly detectLanguagesStep: DetectLanguagesStep,
    private readonly runAdaptersStep: RunAdaptersStep,
    private readonly computeMetricsStep: ComputeMetricsStep,
    private readonly buildGraphStep: BuildGraphStep,
    private readonly scoreStep: ScoreStep,
    private readonly renderDiagramsStep: RenderDiagramsStep,
    private readonly persistStep: PersistStep
  ) {}

  async run(
    input: PipelineInput,
    onProgress: (step: string, percent: number, message?: string) => Promise<void>
  ): Promise<PipelineResult> {
    const tmpRoot = this.config.get('SCAN_TMP_DIR', { infer: true });
    const workdir = path.join(tmpRoot, input.scanId);

    const ctx: PipelineContext = {
      input,
      workdir,
      repoPath: '',
      languages: [],
    };

    const reporter: ProgressReporter = {
      step: async (name, percent, message) => {
        await this.progress.progress(input.scanId, name, percent, message);
        await onProgress(name, percent, message);
      },
    };

    try {
      await this.progress.started(input.scanId);
      await this.cloneStep.run(ctx, reporter);
      await this.detectLanguagesStep.run(ctx, reporter);
      await this.runAdaptersStep.run(ctx, reporter);
      await this.computeMetricsStep.run(ctx, reporter);
      await this.buildGraphStep.run(ctx, reporter);
      await this.scoreStep.run(ctx, reporter);
      await this.renderDiagramsStep.run(ctx, reporter);
      await this.persistStep.run(ctx, reporter);

      if (!ctx.reportId || !ctx.irBlobPath) {
        throw new Error('persist step did not produce a report');
      }

      await this.progress.completed(input.scanId, ctx.reportId);
      return {
        scanId: input.scanId,
        reportId: ctx.reportId,
        irBlobPath: ctx.irBlobPath,
      };
    } finally {
      await this.cleanup(workdir);
    }
  }

  private async cleanup(workdir: string): Promise<void> {
    try {
      await fs.rm(workdir, { recursive: true, force: true });
    } catch (err) {
      this.logger.warn(`Failed to cleanup ${workdir}: ${(err as Error).message}`);
    }
  }
}
