import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../../config/config.types';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { ScansGateway } from './scans.gateway';
import { redisSubscriberProvider } from './redis-subscriber.provider';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [ScansController],
  providers: [ScansService, ScansGateway, redisSubscriberProvider],
  exports: [ScansService],
})
export class ScansModule {}
