import { Injectable } from '@nestjs/common';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

@Injectable()
export class ScoreStep {
  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    if (!ctx.ir) throw new Error('IR missing before score');
    const overall = ctx.ir.scoreBreakdown.overall;
    await progress.step('06-score', 80, `overall=${overall.toFixed(1)} grade=${ctx.ir.grade}`);
  }
}
