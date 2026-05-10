import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { simpleGit } from 'simple-git';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

@Injectable()
export class CloneStep {
  private readonly logger = new Logger(CloneStep.name);

  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    await progress.step('01-clone', 5, `cloning ${ctx.input.cloneUrl}`);

    await fs.mkdir(ctx.workdir, { recursive: true });
    const target = path.join(ctx.workdir, 'src');
    await fs.rm(target, { recursive: true, force: true });

    const git = simpleGit();
    const args: string[] = [];
    if (isRemoteUrl(ctx.input.cloneUrl)) args.push('--depth', '1');
    if (ctx.input.ref) {
      args.push('--branch', ctx.input.ref);
    }
    this.logger.log(`Cloning ${ctx.input.cloneUrl} -> ${target}`);
    await git.clone(ctx.input.cloneUrl, target, args);

    ctx.repoPath = target;
    await progress.step('01-clone', 10, `cloned to ${target}`);
  }
}

function isRemoteUrl(url: string): boolean {
  return /^(https?|ssh|git\+ssh|git):\/\//.test(url) || url.startsWith('git@');
}
