import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';

@Injectable()
export class SourceLoader {
  /**
   * Load the stored source for a single file. Returns null if the report
   * predates source snapshotting (sourceDirPath unset) or the file was
   * skipped during snapshot (e.g. binary). Throws if the dir is set but
   * unreachable.
   */
  async loadFile(sourceDirPath: string | null, irFileId: string): Promise<string | null> {
    if (!sourceDirPath) return null;
    const safeName = sanitizeFileName(irFileId);
    const full = path.join(sourceDirPath, safeName);
    const resolved = path.resolve(full);
    const baseResolved = path.resolve(sourceDirPath);
    if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
      throw new InternalServerErrorException('Refusing to read outside source dir');
    }
    try {
      return await fs.readFile(resolved, 'utf8');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') return null;
      throw new NotFoundException(`Source unavailable: ${err.message}`);
    }
  }
}

function sanitizeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}
