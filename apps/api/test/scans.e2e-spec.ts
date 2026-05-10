import type { INestApplication } from '@nestjs/common';
import IORedis from 'ioredis';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp, resetDb } from './utils/test-app';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function isRedisUp(): Promise<boolean> {
  const r = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
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

async function login(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .get('/auth/github/callback?redirect=false')
    .expect(200);
  return res.body.accessToken as string;
}

describe('Scans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await isRedisUp();
    if (!redisAvailable) {
      console.warn(`Redis not reachable at ${REDIS_URL}; skipping Scans e2e tests.`);
      return;
    }
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    if (!redisAvailable) return;
    await resetDb(prisma);
    token = await login(app);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    if (!redisAvailable) return;
    await request(app.getHttpServer()).get('/scans').expect(401);
    await request(app.getHttpServer()).post('/scans').send({}).expect(401);
  });

  it('POST /scans enqueues a scan and returns a queued status', async () => {
    if (!redisAvailable) return;

    const repoRes = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    const scanRes = await request(app.getHttpServer())
      .post('/scans')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId: repoRes.body.id })
      .expect(201);

    expect(scanRes.body.id).toBeTruthy();
    expect(scanRes.body.repoId).toBe(repoRes.body.id);
    expect(scanRes.body.status).toBe('queued');

    const fetched = await request(app.getHttpServer())
      .get(`/scans/${scanRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fetched.body.id).toBe(scanRes.body.id);

    // Clean up the queued job so a worker (if running) doesn't pick it up later
    await prisma.scan.delete({ where: { id: scanRes.body.id } }).catch(() => undefined);
  });

  it('POST /scans rejects unknown repoId', async () => {
    if (!redisAvailable) return;
    await request(app.getHttpServer())
      .post('/scans')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('GET /scans?repoId=... returns scan history', async () => {
    if (!redisAvailable) return;

    const repoRes = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    const a = await request(app.getHttpServer())
      .post('/scans')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId: repoRes.body.id })
      .expect(201);
    const b = await request(app.getHttpServer())
      .post('/scans')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId: repoRes.body.id })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/scans?repoId=${repoRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const ids = list.body.map((s: { id: string }) => s.id);
    expect(ids).toEqual(expect.arrayContaining([a.body.id, b.body.id]));

    await prisma.scan
      .deleteMany({ where: { id: { in: [a.body.id, b.body.id] } } })
      .catch(() => undefined);
  });
});
