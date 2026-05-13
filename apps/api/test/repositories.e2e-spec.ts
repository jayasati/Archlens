import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp, resetDb } from './utils/test-app';

async function loginAndGetToken(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .get('/auth/github/callback?redirect=false')
    .expect(200);
  return res.body.accessToken as string;
}

describe('Repositories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDb(prisma);
    token = await loginAndGetToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/repositories').expect(401);
    await request(app.getHttpServer())
      .post('/repositories')
      .send({ owner: 'a', name: 'b' })
      .expect(401);
  });

  it('POST /repositories creates a repo for the current user', async () => {
    const res = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    expect(res.body).toMatchObject({
      provider: 'github',
      owner: 'octocat',
      name: 'hello-world',
      fullName: 'octocat/hello-world',
      defaultBranch: 'main',
    });
    expect(res.body.id).toBeTruthy();
  });

  it('POST /repositories rejects invalid bodies (zod validation)', async () => {
    await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: '' })
      .expect(400);
  });

  it('POST /repositories returns 409 on duplicate connection', async () => {
    await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(409);
  });

  it('GET /repositories lists only the current user repos', async () => {
    await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'a' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'b' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toHaveLength(2);
    expect(list.body.map((r: { name: string }) => r.name).sort()).toEqual(['a', 'b']);
  });

  it('GET /repositories/:id returns a specific repo', async () => {
    const created = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fetched.body.id).toBe(created.body.id);
  });

  it('GET /repositories/:id returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .get('/repositories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH /repositories/:id updates the default branch', async () => {
    const created = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'pranjal0jais', name: 'Wandr' })
      .expect(201);
    expect(created.body.defaultBranch).toBe('main');

    const updated = await request(app.getHttpServer())
      .patch(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultBranch: 'master' })
      .expect(200);
    expect(updated.body.defaultBranch).toBe('master');
    expect(updated.body.id).toBe(created.body.id);

    const fetched = await request(app.getHttpServer())
      .get(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fetched.body.defaultBranch).toBe('master');
  });

  it('PATCH /repositories/:id can toggle the private flag', async () => {
    const created = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);
    expect(created.body.private).toBe(false);

    const updated = await request(app.getHttpServer())
      .patch(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ private: true })
      .expect(200);
    expect(updated.body.private).toBe(true);
    // defaultBranch is untouched when only `private` is sent.
    expect(updated.body.defaultBranch).toBe('main');
  });

  it('PATCH /repositories/:id rejects an empty body (zod refine)', async () => {
    const created = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it('PATCH /repositories/:id rejects a blank branch', async () => {
    const created = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultBranch: '' })
      .expect(400);
  });

  it('PATCH /repositories/:id returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .patch('/repositories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultBranch: 'master' })
      .expect(404);
  });

  it('PATCH /repositories/:id requires authentication', async () => {
    await request(app.getHttpServer())
      .patch('/repositories/00000000-0000-0000-0000-000000000000')
      .send({ defaultBranch: 'master' })
      .expect(401);
  });

  it('DELETE /repositories/:id removes the repo', async () => {
    const created = await request(app.getHttpServer())
      .post('/repositories')
      .set('Authorization', `Bearer ${token}`)
      .send({ owner: 'octocat', name: 'hello-world' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/repositories/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
