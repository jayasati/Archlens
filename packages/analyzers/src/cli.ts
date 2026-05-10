#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { validateIR } from '@archlens/ir-schema';
import { PythonAdapter } from './adapters/python/python.adapter.js';

interface CliOptions {
  out?: string;
  pretty?: boolean;
  name?: string;
}

const program = new Command();

program
  .name('archlens-analyze')
  .description('Analyze a repo and emit Archlens IR JSON')
  .argument('<repo-path>', 'path to the repo to analyze')
  .option('-o, --out <file>', 'write IR JSON to file instead of stdout')
  .option('--pretty', 'pretty-print JSON output', false)
  .option('--name <name>', 'override repo name')
  .action(async (repoPath: string, options: CliOptions) => {
    const adapter = new PythonAdapter();
    const ir = await adapter.analyze(repoPath, {
      repoName: options.name ?? path.basename(path.resolve(repoPath)),
    });
    const validated = validateIR(ir);
    const json = options.pretty ? JSON.stringify(validated, null, 2) : JSON.stringify(validated);
    if (options.out) {
      await fs.writeFile(options.out, json, 'utf8');
      process.stderr.write(`Wrote IR to ${options.out}\n`);
    } else {
      process.stdout.write(json + '\n');
    }
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(
    `archlens-analyze failed: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
