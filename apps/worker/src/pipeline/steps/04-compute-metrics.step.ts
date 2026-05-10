import { Injectable } from '@nestjs/common';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

@Injectable()
export class ComputeMetricsStep {
  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    if (!ctx.ir) throw new Error('IR missing before compute-metrics');
    const totalFns = ctx.ir.modules
      .flatMap((m) => m.files)
      .reduce(
        (acc, f) => acc + f.functions.length + f.classes.reduce((a, c) => a + c.methods.length, 0),
        0
      );
    await progress.step('04-compute-metrics', 60, `metrics over ${totalFns} functions`);
  }
}
