import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp, resetDb } from './utils/test-app';
import { MOCK_GITHUB_PROFILE } from './utils/mock-github-strategy';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/github/callback issues access + refresh tokens (mocked GitHub)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/github/callback?redirect=false')
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.expiresIn).toBeGreaterThan(0);

    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: MOCK_GITHUB_PROFILE.providerAccountId,
        },
      },
      include: { user: true },
    });
    expect(account).not.toBeNull();
    expect(account?.user.githubUsername).toBe(MOCK_GITHUB_PROFILE.username);
  });

  it('GET /auth/github/callback (default mode) redirects to web app with tokens in query', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/github/callback')
      .redirects(0)
      .expect(302);

    const location = res.headers.location as string;
    expect(location).toContain('/auth/callback');
    expect(location).toMatch(/accessToken=/);
    expect(location).toMatch(/refreshToken=/);
    // Regression: redirect must not be followed by a JSON body write
    // (would trigger ERR_HTTP_HEADERS_SENT in the controller).
    expect(res.text).toBe('Found. Redirecting to ' + location);
  });

  it('GET /auth/github/callback is idempotent for same GitHub user', async () => {
    await request(app.getHttpServer()).get('/auth/github/callback?redirect=false').expect(200);
    await request(app.getHttpServer()).get('/auth/github/callback?redirect=false').expect(200);

    const userCount = await prisma.user.count();
    expect(userCount).toBe(1);
  });

  it('POST /auth/refresh rotates tokens for a valid refresh token', async () => {
    const login = await request(app.getHttpServer())
      .get('/auth/github/callback?redirect=false')
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBeTruthy();
  });

  it('POST /auth/refresh rejects invalid refresh tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'this-is-not-a-valid-jwt' })
      .expect(401);
  });

  it('POST /auth/refresh validates request body shape', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').send({}).expect(400);
  });

  it('GET /healthz is public and returns 200', async () => {
    const res = await request(app.getHttpServer()).get('/healthz').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /users/me without a token returns 401', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('GET /users/me with a valid token returns the user', async () => {
    const login = await request(app.getHttpServer())
      .get('/auth/github/callback?redirect=false')
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body.githubUsername).toBe(MOCK_GITHUB_PROFILE.username);
    expect(me.body.email).toBe(MOCK_GITHUB_PROFILE.email);
  });
});
