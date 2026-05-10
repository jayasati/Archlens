import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://archlens:archlens@localhost:5433/archlens?schema=public';
delete process.env.DIRECT_DATABASE_URL;
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.SCAN_TMP_DIR =
  process.env.SCAN_TMP_DIR ?? path.join(os.tmpdir(), 'archlens-scans-test');
process.env.IR_REPORTS_DIR =
  process.env.IR_REPORTS_DIR ?? path.join(os.tmpdir(), 'archlens-reports-test');
process.env.WORKER_CONCURRENCY = process.env.WORKER_CONCURRENCY ?? '1';

// API env (the integration test bootstraps the API too)
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-test-refresh-secret';
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '900';
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '2592000';
process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? 'test-client-secret';
process.env.GITHUB_CALLBACK_URL =
  process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:3001/auth/github/callback';
process.env.WEB_APP_URL = process.env.WEB_APP_URL ?? 'http://localhost:3000';
