import { promises as fs } from 'node:fs';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Repo } from '@archlens/ir-schema';

@Injectable()
export class IrLoader {
  async load(blobPath: string): Promise<Repo> {
    let raw: string;
    try {
      raw = await fs.readFile(blobPath, 'utf8');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new NotFoundException(`IR blob missing at ${blobPath}`);
      }
      throw new InternalServerErrorException(`Failed to read IR blob: ${err.message}`);
    }
    try {
      return JSON.parse(raw) as Repo;
    } catch (e) {
      throw new InternalServerErrorException(`IR blob is not valid JSON: ${(e as Error).message}`);
    }
  }
}
