import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/validation.schema';
import { PrismaModule } from './database/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ProcessorsModule } from './processors/processors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    ProgressModule,
    PipelineModule,
    ProcessorsModule,
  ],
})
export class WorkerModule {}
