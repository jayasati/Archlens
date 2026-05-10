import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp, resetDb } from './utils/test-app';
import {
  cleanupSeededReport,
  FIXTURE_IR,
  seedReport,
  type SeededReport,
} from './utils/seed-report';

async function loginAndGetToken(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .get('/auth/github/callback?redirect=false')
    .expect(200);
  return res.body.accessToken as string;
}

async function createRepo(app: INestApplication, token: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/repositories')
    .set('Authorization', `Bearer ${token}`)
    .send({ owner: 'octocat', name: 'sample' })
    .expect(201);
  return res.body.id as string;
}

async function createScanRow(prisma: PrismaService, repoId: string): Promise<string> {
  const scan = await prisma.scan.create({
    data: {
      repoId,
      cloneUrl: 'https://example.invalid/octocat/sample.git',
      ref: 'main',
      status: 'completed',
    },
  });
  return scan.id;
}

describe('Reports / Architecture / Hotspots (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let repoId: string;
  let seed: SeededReport;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    token = await loginAndGetToken(app);
    repoId = await createRepo(app, token);
    const scanId = await createScanRow(prisma, repoId);
    seed = await seedReport(prisma, { scanId, repoId });
  });

  afterEach(async () => {
    if (seed) await cleanupSeededReport(seed);
  });

  describe('GET /reports/:scanId', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get(`/reports/${seed.scanId}`).expect(401);
    });

    it('returns the full report summary', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/${seed.scanId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: seed.reportId,
        scanId: seed.scanId,
        repoId,
        ir_version: FIXTURE_IR.ir_version,
        grade: FIXTURE_IR.grade,
        scoreBreakdown: FIXTURE_IR.scoreBreakdown,
      });
      expect(res.body.counts).toEqual({
        modules: 2,
        files: 3,
        classes: 1,
        functions: 4,
        smells: 3,
      });
      expect(Array.isArray(res.body.topSmells)).toBe(true);
      expect(res.body.topSmells.length).toBeGreaterThan(0);
      // critical smell should rank first
      expect(res.body.topSmells[0].severity).toBe('critical');
    });

    it('returns 404 when the scan has no report yet', async () => {
      const queued = await prisma.scan.create({
        data: {
          repoId,
          cloneUrl: 'https://example.invalid/octocat/sample.git',
          ref: 'main',
          status: 'queued',
        },
      });
      await request(app.getHttpServer())
        .get(`/reports/${queued.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('forbids access for users who do not own the repo', async () => {
      const other = await prisma.user.create({
        data: { email: 'other@example.com', githubUsername: 'other' },
      });
      const otherRepo = await prisma.repository.create({
        data: {
          userId: other.id,
          provider: 'github',
          owner: 'someoneelse',
          name: 'private',
          fullName: 'someoneelse/private',
          defaultBranch: 'main',
        },
      });
      const otherScanId = await createScanRow(prisma, otherRepo.id);
      const otherSeed = await seedReport(prisma, {
        scanId: otherScanId,
        repoId: otherRepo.id,
      });

      try {
        await request(app.getHttpServer())
          .get(`/reports/${otherSeed.scanId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
      } finally {
        await cleanupSeededReport(otherSeed);
      }
    });
  });

  describe('GET /reports/:scanId/modules', () => {
    it('returns the module list with aggregated scores', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/${seed.scanId}/modules`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      const core = res.body.find((m: { irModuleId: string }) => m.irModuleId === 'mod-core');
      expect(core).toBeDefined();
      expect(core).toMatchObject({
        irModuleId: 'mod-core',
        name: 'core',
        virtual: false,
        fileCount: 2,
        classCount: 1,
        smellCount: 1,
      });
      expect(core.totalComplexity).toBe(7 + 3 + 2);
      expect(core.maxComplexity).toBe(7);
      expect(core.id).toBeTruthy();
    });
  });

  describe('GET /reports/:scanId/modules/:moduleId', () => {
    it('returns module detail with files', async () => {
      const list = await request(app.getHttpServer())
        .get(`/reports/${seed.scanId}/modules`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const core = list.body.find((m: { irModuleId: string }) => m.irModuleId === 'mod-core');

      const res = await request(app.getHttpServer())
        .get(`/reports/${seed.scanId}/modules/${core.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(core.id);
      expect(res.body.name).toBe('core');
      expect(Array.isArray(res.body.files)).toBe(true);
      expect(res.body.files).toHaveLength(2);
      const indexFile = res.body.files.find(
        (f: { path: string }) => f.path === 'src/core/index.ts'
      );
      expect(indexFile).toBeDefined();
      expect(indexFile.complexity).toBe(7 + 3);
      expect(indexFile.smellCount).toBe(1);
    });

    it('returns 404 when the module belongs to a different report', async () => {
      const fake = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/reports/${seed.scanId}/modules/${fake}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /reports/:scanId/files/:filePath', () => {
    it('returns the file detail (with classes, functions, smells)', async () => {
      const filePath = encodeURIComponent('src/web/app.ts');
      const res = await request(app.getHttpServer())
        .get(`/reports/${seed.scanId}/files/${filePath}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.path).toBe('src/web/app.ts');
      expect(res.body.language).toBe('typescript');
      expect(res.body.loc).toBe(80);
      expect(res.body.totalComplexity).toBe(5);
      expect(res.body.functions).toHaveLength(1);
      expect(res.body.classes).toHaveLength(0);
      expect(Array.isArray(res.body.smells)).toBe(true);
      expect(res.body.smells.length).toBeGreaterThanOrEqual(2);
      const ids = res.body.smells.map((s: { id: string }) => s.id).sort();
      expect(ids).toEqual(['smell-web-1', 'smell-web-critical']);
    });

    it('returns 404 for an unknown file path', async () => {
      await request(app.getHttpServer())
        .get(`/reports/${seed.scanId}/files/${encodeURIComponent('does/not/exist.ts')}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /architecture/:scanId', () => {
    it('returns mermaid string + IR graph nodes/edges', async () => {
      const res = await request(app.getHttpServer())
        .get(`/architecture/${seed.scanId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.reportId).toBe(seed.reportId);
      expect(res.body.repoId).toBe(repoId);
      expect(res.body.modules).toHaveLength(2);
      expect(res.body.edges).toEqual(FIXTURE_IR.edges);
      expect(res.body.diagram.format).toBe('mermaid');
      expect(res.body.diagram.source.split('\n')[0]).toBe('graph LR');
      expect(res.body.diagram.source).toContain('-->');
      expect(Array.isArray(res.body.cycles)).toBe(true);
    });
  });

  describe('GET /hotspots/:scanId', () => {
    it('returns scatter data (complexity x churn) for each file', async () => {
      const res = await request(app.getHttpServer())
        .get(`/hotspots/${seed.scanId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);
      for (const h of res.body) {
        expect(typeof h.fileId).toBe('string');
        expect(typeof h.path).toBe('string');
        expect(typeof h.complexity).toBe('number');
        expect(typeof h.churn).toBe('number');
        expect(h.churn).toBeGreaterThanOrEqual(1);
        expect(h.riskScore).toBe(h.complexity * h.churn);
      }
      // sorted desc by riskScore
      for (let i = 1; i < res.body.length; i++) {
        expect(res.body[i - 1].riskScore).toBeGreaterThanOrEqual(res.body[i].riskScore);
      }
    });
  });
});
