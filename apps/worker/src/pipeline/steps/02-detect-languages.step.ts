import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

const SKIP = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.turbo',
]);

const EXT_TO_LANG: Record<string, string> = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.java': 'java',
};

@Injectable()
export class DetectLanguagesStep {
  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    await progress.step('02-detect-languages', 15, 'scanning files');
    const counts = new Map<string, number>();
    await this.walk(ctx.repoPath, counts);

    const languages = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);

    if (languages.length === 0) {
      throw new Error('No supported source files detected');
    }
    ctx.languages = languages;
    await progress.step('02-detect-languages', 20, `detected: ${languages.join(', ')}`);
  }

  private async walk(dir: string, counts: Map<string, number>): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(abs, counts);
      } else if (entry.isFile()) {
        const lang = EXT_TO_LANG[path.extname(entry.name).toLowerCase()];
        if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
      }
    }
  }
}
