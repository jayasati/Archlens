import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { GithubStrategy } from '../../src/modules/auth/strategies/github.strategy';
import { MockGithubStrategyProvider } from './mock-github-strategy';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GithubStrategy)
    .useClass(MockGithubStrategyProvider)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);
  await resetDb(prisma);

  return { app, prisma };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.smell.deleteMany();
  await prisma.file.deleteMany();
  await prisma.module.deleteMany();
  await prisma.report.deleteMany();
  await prisma.scan.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}
