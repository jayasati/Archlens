import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

const defaultScanTmpDir = path.join(os.tmpdir(), 'archlens-scans');
const defaultReportsDir =
  process.platform === 'win32'
    ? path.join(os.tmpdir(), 'archlens-reports')
    : '/var/lib/archlens/reports';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SCAN_TMP_DIR: z.string().default(defaultScanTmpDir),
  IR_REPORTS_DIR: z.string().default(defaultReportsDir),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid worker environment:\n${formatted}`);
  }
  return result.data;
}
