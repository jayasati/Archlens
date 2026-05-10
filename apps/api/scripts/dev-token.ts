/**
 * Mints a JWT for a local "dev" user and prints copy-pasteable curl commands.
 * Skips real GitHub OAuth — useful for poking at /scans during development.
 *
 * Run from repo root:
 *   pnpm --filter @archlens/api dev-token
 */
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

async function main(): Promise<void> {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_ACCESS_SECRET is not set (or too short). Check apps/api/.env');
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email: 'dev@archlens.local' },
      update: {},
      create: {
        email: 'dev@archlens.local',
        name: 'Dev User',
        githubUsername: 'dev-user',
      },
    });

    const token = jwt.sign(
      { sub: user.id, email: user.email, githubUsername: user.githubUsername },
      secret,
      { expiresIn: 3600 }
    );

    const port = process.env.PORT ?? '3001';
    const base = `http://localhost:${port}`;

    console.log('--- Dev user ---');
    console.log(`userId : ${user.id}`);
    console.log(`token  : ${token}`);
    console.log('');
    console.log('--- Use it like this ---');
    console.log(`# 1) Connect a (Python) repo`);
    console.log(`curl -s ${base}/repositories \\`);
    console.log(`  -H "Authorization: Bearer ${token}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(
      `  -d '{"owner":"tiangolo","name":"fastapi","htmlUrl":"https://github.com/tiangolo/fastapi.git"}'`
    );
    console.log('');
    console.log(`# 2) Enqueue a scan (replace REPO_ID with the id from step 1)`);
    console.log(`curl -s ${base}/scans \\`);
    console.log(`  -H "Authorization: Bearer ${token}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"repoId":"REPO_ID"}'`);
    console.log('');
    console.log(`# 3) Poll the scan (replace SCAN_ID)`);
    console.log(`curl -s ${base}/scans/SCAN_ID -H "Authorization: Bearer ${token}"`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
