import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import IORedis from 'ioredis';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { SCAN_EVENTS, type ScanEvent, type ScanProgressEvent } from '@archlens/shared-types';
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

async function createRepoAndScan(
  app: INestApplication,
  token: string
): Promise<{ repoId: string; scanId: string }> {
  const repo = await request(app.getHttpServer())
    .post('/repositories')
    .set('Authorization', `Bearer ${token}`)
    .send({ owner: 'octocat', name: 'hello-world' })
    .expect(201);
  const scan = await request(app.getHttpServer())
    .post('/scans')
    .set('Authorization', `Bearer ${token}`)
    .send({ repoId: repo.body.id })
    .expect(201);
  return { repoId: repo.body.id, scanId: scan.body.id };
}

function awaitNext<T>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 5_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('ScansGateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let publisher: IORedis;
  let serverUrl: string;
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await isRedisUp();
    if (!redisAvailable) {
      console.warn(`Redis not reachable at ${REDIS_URL}; skipping ScansGateway e2e tests.`);
      return;
    }
    ({ app, prisma } = await createTestApp());
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    serverUrl = `http://localhost:${addr.port}`;
    publisher = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  });

  beforeEach(async () => {
    if (!redisAvailable) return;
    await resetDb(prisma);
    token = await login(app);
  });

  afterAll(async () => {
    if (publisher) publisher.disconnect();
    if (app) await app.close();
  });

  it('rejects sockets with no auth token', async () => {
    if (!redisAvailable) return;

    const socket = io(`${serverUrl}/scans`, {
      transports: ['websocket'],
      reconnection: false,
      auth: {},
    });
    try {
      const err = await new Promise<Error>((resolve) => {
        socket.on('disconnect', () => resolve(new Error('disconnected')));
        socket.on('connect_error', (e: Error) => resolve(e));
      });
      expect(err).toBeDefined();
    } finally {
      socket.disconnect();
    }
  });

  it('subscribed client receives Started → Progress → Completed in order', async () => {
    if (!redisAvailable) return;

    const { scanId } = await createRepoAndScan(app, token);

    const socket = io(`${serverUrl}/scans`, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token },
    });

    await awaitNext<void>(socket, 'connect');

    const ack = await new Promise<{ ok?: boolean; scanId?: string }>((resolve) => {
      socket.emit('subscribe', { scanId }, resolve);
    });
    expect(ack.ok).toBe(true);
    expect(ack.scanId).toBe(scanId);

    const channel = `archlens:scan:${scanId}`;
    const collected: ScanEvent[] = [];
    socket.on('scan-event', (e: ScanEvent) => collected.push(e));

    await publisher.publish(
      channel,
      JSON.stringify({ type: SCAN_EVENTS.Started, scanId, at: new Date().toISOString() })
    );
    await publisher.publish(
      channel,
      JSON.stringify({
        type: SCAN_EVENTS.Progress,
        scanId,
        step: 'clone',
        percent: 10,
        at: new Date().toISOString(),
      } satisfies ScanProgressEvent)
    );
    await publisher.publish(
      channel,
      JSON.stringify({
        type: SCAN_EVENTS.Progress,
        scanId,
        step: 'analyze',
        percent: 60,
        at: new Date().toISOString(),
      } satisfies ScanProgressEvent)
    );
    await publisher.publish(
      channel,
      JSON.stringify({
        type: SCAN_EVENTS.Completed,
        scanId,
        reportId: '00000000-0000-0000-0000-000000000aaa',
        at: new Date().toISOString(),
      })
    );

    // Wait for the completed event to arrive.
    const start = Date.now();
    while (collected.find((e) => e.type === SCAN_EVENTS.Completed) === undefined) {
      if (Date.now() - start > 5_000) throw new Error('Did not receive completed event');
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(collected.map((e) => e.type)).toEqual([
      SCAN_EVENTS.Started,
      SCAN_EVENTS.Progress,
      SCAN_EVENTS.Progress,
      SCAN_EVENTS.Completed,
    ]);

    socket.disconnect();
  });

  it("rejects subscribe to another user's scan", async () => {
    if (!redisAvailable) return;

    const { scanId } = await createRepoAndScan(app, token);

    // Wipe accounts and log in as a fresh user.
    await prisma.account.deleteMany();
    await prisma.user.deleteMany({ where: { id: { not: undefined } } });
    const otherToken = await login(app);

    const socket = io(`${serverUrl}/scans`, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: otherToken },
    });
    await awaitNext<void>(socket, 'connect');

    const ack = await new Promise<{ ok?: boolean } | unknown>((resolve) => {
      socket.emit('subscribe', { scanId }, resolve);
    });
    // Subscribing to someone else's scan must not return ok:true.
    expect((ack as { ok?: boolean }).ok).not.toBe(true);

    socket.disconnect();
  });
});
