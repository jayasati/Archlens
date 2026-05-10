import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Test, type TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { simpleGit } from 'simple-git';
import { PrismaClient } from '@prisma/client';
import { isValidIR } from '@archlens/ir-schema';
import { WorkerModule } from '../src/worker.module';

const FIXTURE_SRC = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'analyzers',
  'test',
  'fixtures',
  'python-fastapi-sample'
);

async function copyDir(src: string, dst: string): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else if (entry.isFile()) await fs.copyFile(s, d);
  }
}

async function makeFixtureGitRepo(): Promise<string> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archlens-fixture-'));
  await copyDir(FIXTURE_SRC, tmpRoot);
  const git = simpleGit(tmpRoot);
  await git.init();
  await git.addConfig('user.email', 'test@archlens.local');
  await git.addConfig('user.name', 'Archlens Test');
  await git.addConfig('commit.gpgsign', 'false');
  await git.add('.');
  await git.raw(['commit', '-m', 'initial fixture commit', '--no-gpg-sign']);
  await git.raw(['branch', '-M', 'main']);
  return tmpRoot;
}

async function isRedisUp(url: string): Promise<boolean> {
  const r = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await r.connect();
    await r.ping();
    return true;
  } catch {
    return false;
  } finally {
    r.disconnect();
  }
}

async function isPostgresUp(): Promise<boolean> {
  const c = new PrismaClient();
  try {
    await c.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await c.$disconnect();
  }
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('Scan pipeline (integration)', () => {
  let prisma: PrismaClient;
  let workerApp: TestingModule;
  let producerQueue: Queue;
  let producerConn: IORedis;
  let userId: string;
  let repoId: string;
  let fixturePath: string;

  beforeAll(async () => {
    if (!(await isRedisUp(REDIS_URL))) {
      throw new Error(`Redis is not reachable at ${REDIS_URL}. Start it with docker compose.`);
    }
    if (!(await isPostgresUp())) {
      throw new Error(`Postgres is not reachable. Start it with docker compose and migrate.`);
    }

    prisma = new PrismaClient();
    await prisma.$connect();
    // Clean any old test rows; cascades take care of scans/reports/etc.
    await prisma.user.deleteMany({ where: { email: 'integration@archlens.local' } });

    const user = await prisma.user.create({
      data: {
        email: 'integration@archlens.local',
        name: 'Integration',
        githubUsername: 'integration-test',
      },
    });
    userId = user.id;

    fixturePath = await makeFixtureGitRepo();

    const repo = await prisma.repository.create({
      data: {
        userId,
        provider: 'github',
        owner: 'archlens',
        name: 'fixture',
        fullName: 'archlens/fixture',
        defaultBranch: 'main',
        private: false,
        htmlUrl: fixturePath,
      },
    });
    repoId = repo.id;

    producerConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    producerQueue = new Queue('scans', { connection: producerConn });
    await producerQueue.drain(true).catch(() => undefined);
    await producerQueue.obliterate({ force: true }).catch(() => undefined);

    workerApp = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();
    await workerApp.init();
  });

  afterAll(async () => {
    await producerQueue?.close();
    producerConn?.disconnect();
    await workerApp?.close();
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: 'integration@archlens.local' } });
      await prisma.$disconnect();
    }
    if (fixturePath) {
      await fs.rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('processes a queued scan end-to-end and persists report rows + IR file', async () => {
    const scan = await prisma.scan.create({
      data: {
        repoId,
        cloneUrl: fixturePath,
        ref: 'main',
        status: 'queued',
      },
    });

    await producerQueue.add(
      'scans',
      { scanId: scan.id, repoId, cloneUrl: fixturePath, ref: 'main' },
      { jobId: scan.id, removeOnComplete: true, removeOnFail: true }
    );

    const finalScan = await pollUntil(async () => {
      const s = await prisma.scan.findUnique({ where: { id: scan.id } });
      if (!s) return null;
      if (s.status === 'completed' || s.status === 'failed') return s;
      return null;
    }, 90_000);

    if (!finalScan) throw new Error('scan did not complete in time');
    if (finalScan.status === 'failed') {
      throw new Error(`scan failed: ${finalScan.error ?? 'unknown'}`);
    }
    expect(finalScan.status).toBe('completed');
    expect(finalScan.progressPct).toBe(100);
    expect(finalScan.finishedAt).toBeTruthy();

    const report = await prisma.report.findUnique({ where: { scanId: scan.id } });
    expect(report).toBeTruthy();
    expect(report!.modulesCount).toBeGreaterThan(0);
    expect(report!.filesCount).toBeGreaterThan(0);
    expect(['A', 'B', 'C', 'D', 'E']).toContain(report!.grade);

    const modules = await prisma.module.findMany({ where: { reportId: report!.id } });
    expect(modules.length).toBeGreaterThan(0);
    const files = await prisma.file.findMany({ where: { reportId: report!.id } });
    expect(files.length).toBeGreaterThan(0);

    const irRaw = await fs.readFile(report!.irBlobPath, 'utf8');
    const ir = JSON.parse(irRaw);
    expect(isValidIR(ir)).toBe(true);
  });
});

async function pollUntil<T>(
  fn: () => Promise<T | null>,
  timeoutMs: number,
  intervalMs = 500
): Promise<T | null> {
  const start = Date.now();
  for (;;) {
    const val = await fn();
    if (val !== null) return val;
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
