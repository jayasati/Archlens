import { Injectable } from '@nestjs/common';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

@Injectable()
export class BuildGraphStep {
  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    if (!ctx.ir) throw new Error('IR missing before build-graph');
    await progress.step(
      '05-build-graph',
      70,
      `${ctx.ir.modules.length} nodes / ${ctx.ir.edges.length} edges`
    );
  }
}
