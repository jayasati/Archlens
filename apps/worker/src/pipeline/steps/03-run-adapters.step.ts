import { Injectable, Logger } from '@nestjs/common';
import { analyzeRepo } from '@archlens/analyzers';
import type { Language } from '@archlens/ir-schema';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

const SUPPORTED: ReadonlySet<Language> = new Set(['python', 'typescript', 'javascript']);

@Injectable()
export class RunAdaptersStep {
  private readonly logger = new Logger(RunAdaptersStep.name);

  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    const supported = ctx.languages.filter((l): l is Language => SUPPORTED.has(l as Language));
    if (supported.length === 0) {
      throw new Error(
        `No supported adapter for languages: ${ctx.languages.join(', ')} (supported: ${Array.from(SUPPORTED).join(', ')})`
      );
    }

    await progress.step('03-run-adapters', 30, `running adapters: ${supported.join(', ')}`);
    const ir = await analyzeRepo(ctx.repoPath, {
      repoId: ctx.input.repoId,
      languages: supported,
    });
    ctx.ir = ir;
    this.logger.log(
      `Adapters produced ${ir.modules.length} modules, ${ir.edges.length} edges, languages=${ir.languages.join(',')}`
    );
    await progress.step('03-run-adapters', 50, `produced ${ir.modules.length} modules`);
  }
}
