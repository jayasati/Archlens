process.env.NODE_ENV = 'test';
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

// Tests truncate tables. Always pin to local Docker — never let the dev
// .env (which may point at Neon/staging/prod) leak into the test runner.
process.env.DATABASE_URL = 'postgresql://archlens:archlens@localhost:5433/archlens?schema=public';
delete process.env.DIRECT_DATABASE_URL;
