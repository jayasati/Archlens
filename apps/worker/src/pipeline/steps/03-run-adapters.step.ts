import { Injectable, Logger } from '@nestjs/common';
import { analyzeRepo } from '@archlens/analyzers';
import type { Language } from '@archlens/ir-schema';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

const SUPPORTED: ReadonlySet<Language> = new Set(['python', 'typescript', 'javascript', 'java']);

@Injectable()
export class RunAdaptersStep {
  private readonly logger = new Logger(RunAdaptersStep.name);

  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    const supported = ctx.languages.filter((l): l is Language => SUPPORTED.has(l as Language));
    this.logger.log(
      `step 03: detected languages=[${ctx.languages.join(',')}] supported=[${supported.join(',')}] repoPath=${ctx.repoPath}`
    );

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
      `step 03: produced ${ir.modules.length} modules, ${ir.edges.length} edges, ` +
        `languages=[${ir.languages.join(',')}], grade=${ir.grade}, overall=${ir.scoreBreakdown.overall}`
    );
    if (ir.modules.length <= 1) {
      this.logger.warn(
        `step 03: only ${ir.modules.length} module(s) — check that package declarations are present and the right adapter ran for ${ctx.languages.join(',')}`
      );
    }
    await progress.step('03-run-adapters', 50, `produced ${ir.modules.length} modules`);
  }
}
