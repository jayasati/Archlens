import 'server-only';
import { cache } from 'react';
import type { RepositoryDto, ScanDto } from '@archlens/shared-types';
import { listReposServer } from './repos';
import { listScansServer } from './scans';

export interface RepoContext {
  repo: RepositoryDto;
  scans: ScanDto[];
}

/**
 * Resolves a repo + ALL of its scans in a single round-trip pair.
 *
 * Why: every repo page (overview, architecture, hotspots, settings) needs
 * to look up the repo by owner/name AND list its scans. Doing those
 * sequentially takes 2× the round-trip latency. Doing them in parallel and
 * filtering on the server saves us one round-trip on every page render.
 *
 * Wrapped with React's cache() so multiple components within a single page
 * render share one result.
 */
export const loadRepoContext = cache(
  async (token: string, owner: string, name: string): Promise<RepoContext | null> => {
    const [repos, allScans] = await Promise.all([
      listReposServer(token),
      // The user might have many repos; we still hit /scans once and filter.
      // Returns [] on error so a transient scan-list failure doesn't 500 the page.
      listScansServer(token).catch(() => [] as ScanDto[]),
    ]);

    const ownerLc = owner.toLowerCase();
    const nameLc = name.toLowerCase();
    const repo = repos.find(
      (r) => r.owner.toLowerCase() === ownerLc && r.name.toLowerCase() === nameLc
    );
    if (!repo) return null;

    const scans = allScans
      .filter((s) => s.repoId === repo.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { repo, scans };
  }
);

export function latestCompletedScan(scans: ScanDto[]): ScanDto | null {
  return scans.find((s) => s.status === 'completed') ?? null;
}
