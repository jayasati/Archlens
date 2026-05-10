import { Injectable, Logger } from '@nestjs/common';
import { PythonAdapter } from '@archlens/analyzers';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

@Injectable()
export class RunAdaptersStep {
  private readonly logger = new Logger(RunAdaptersStep.name);

  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    if (!ctx.languages.includes('python')) {
      throw new Error(
        `No supported adapter for languages: ${ctx.languages.join(', ')} (python only in this phase)`
      );
    }

    await progress.step('03-run-adapters', 30, 'running python adapter');
    const adapter = new PythonAdapter();
    const ir = await adapter.analyze(ctx.repoPath, {
      repoId: ctx.input.repoId,
    });
    ctx.ir = ir;
    this.logger.log(
      `Python adapter produced ${ir.modules.length} modules, ${ir.edges.length} edges`
    );
    await progress.step('03-run-adapters', 50, `produced ${ir.modules.length} modules`);
  }
}
