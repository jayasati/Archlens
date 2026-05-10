import type { Page } from '@playwright/test';
import type {
  ReportModuleScoreDto,
  ReportSummaryDto,
  RepositoryDto,
  ScanDto,
} from '@archlens/shared-types';

export const SEED_REPO: RepositoryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  provider: 'github',
  owner: 'acme',
  name: 'widgets',
  fullName: 'acme/widgets',
  defaultBranch: 'main',
  private: false,
  htmlUrl: 'https://github.com/acme/widgets',
  connectedAt: new Date('2026-04-15T12:00:00Z').toISOString(),
};

export const SEED_SCAN: ScanDto = {
  id: '22222222-2222-4222-8222-222222222222',
  repoId: SEED_REPO.id,
  status: 'completed',
  createdAt: new Date('2026-05-09T10:00:00Z').toISOString(),
  startedAt: new Date('2026-05-09T10:00:00Z').toISOString(),
  finishedAt: new Date('2026-05-09T10:01:30Z').toISOString(),
  reportId: '33333333-3333-4333-8333-333333333333',
};

export const SEED_REPORT: ReportSummaryDto = {
  id: SEED_SCAN.reportId!,
  scanId: SEED_SCAN.id,
  repoId: SEED_REPO.id,
  ir_version: '1.0.0',
  grade: 'B',
  scoreBreakdown: {
    complexity: 78,
    duplication: 82,
    coupling: 70,
    cohesion: 85,
    smells: 72,
    overall: 77,
  },
  counts: { modules: 4, files: 42, classes: 30, functions: 120, smells: 9 },
  topSmells: [],
  generatedAt: SEED_SCAN.finishedAt!,
};

export const SEED_MODULES: ReportModuleScoreDto[] = [
  {
    id: 'mod-1',
    irModuleId: 'mod-1',
    name: 'core',
    virtual: false,
    fileCount: 12,
    classCount: 8,
    functionCount: 40,
    smellCount: 2,
    totalLoc: 1200,
    totalComplexity: 80,
    avgComplexity: 6.7,
    maxComplexity: 18,
  },
  {
    id: 'mod-2',
    irModuleId: 'mod-2',
    name: 'api',
    virtual: false,
    fileCount: 18,
    classCount: 14,
    functionCount: 60,
    smellCount: 5,
    totalLoc: 2400,
    totalComplexity: 140,
    avgComplexity: 7.8,
    maxComplexity: 24,
  },
];

/**
 * Intercepts API calls from the web app and serves seeded data.
 * Targets ARCHLENS_API_URL (server-side) and NEXT_PUBLIC_API_URL (client-side).
 */
export async function mockArchlensApi(page: Page) {
  await page.route(/.*\/repositories$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([SEED_REPO]),
    });
  });

  await page.route(/.*\/scans(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([SEED_SCAN]),
    });
  });

  await page.route(new RegExp(`.*/reports/${SEED_SCAN.id}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SEED_REPORT),
    });
  });

  await page.route(new RegExp(`.*/reports/${SEED_SCAN.id}/modules$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SEED_MODULES),
    });
  });
}
