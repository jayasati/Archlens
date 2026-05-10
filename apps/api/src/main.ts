import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './config/config.types';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('PORT', { infer: true });
  const webUrl = config.get('WEB_APP_URL', { infer: true });

  app.enableCors({
    origin: webUrl ?? true,
    credentials: true,
  });

  await app.listen(port);
  new Logger('Bootstrap').log(`Archlens API listening on http://localhost:${port}`);
}

void bootstrap();
