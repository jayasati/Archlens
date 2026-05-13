import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Repo } from '@archlens/ir-schema';

export interface SnapshotFileRecord {
  irFileId: string;
  storedPath: string;
  sha256: string;
  byteSize: number;
  truncated: boolean;
}

export interface SnapshotResult {
  sourceDir: string;
  files: Map<string, SnapshotFileRecord>;
}

const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;

/**
 * Copy each file referenced by the IR out of the soon-to-be-deleted clone
 * into a stable per-scan source directory the API can serve from. Files larger
 * than MAX_FILE_BYTES are marked truncated and stored up to the cap; we stop
 * altogether once MAX_ARCHIVE_BYTES is reached.
 */
export async function snapshotSourceFiles(
  ir: Repo,
  repoPath: string,
  reportsDir: string,
  scanId: string
): Promise<SnapshotResult> {
  const sourceDir = path.join(reportsDir, `${scanId}-src`);
  await fs.rm(sourceDir, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });

  const records = new Map<string, SnapshotFileRecord>();
  let archiveBytes = 0;

  for (const mod of ir.modules) {
    for (const irFile of mod.files) {
      if (archiveBytes >= MAX_ARCHIVE_BYTES) break;
      const abs = path.join(repoPath, irFile.path);
      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;

      const remainingBudget = MAX_ARCHIVE_BYTES - archiveBytes;
      const allowed = Math.min(MAX_FILE_BYTES, remainingBudget);
      const truncated = stat.size > allowed;
      const readBytes = truncated ? allowed : stat.size;

      const fh = await fs.open(abs, 'r');
      try {
        const buf = Buffer.alloc(readBytes);
        await fh.read(buf, 0, readBytes, 0);
        const dest = path.join(sourceDir, sanitizeFileName(irFile.id));
        await fs.writeFile(dest, buf);
        const sha = createHash('sha256').update(buf).digest('hex');
        records.set(irFile.id, {
          irFileId: irFile.id,
          storedPath: dest,
          sha256: sha,
          byteSize: stat.size,
          truncated,
        });
        archiveBytes += readBytes;
      } finally {
        await fh.close();
      }
    }
  }

  return { sourceDir, files: records };
}

/** Defence-in-depth: irFileId is analyzer-generated and safe, but keep it
 * filesystem-safe in case adapters ever change the format. */
function sanitizeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}
