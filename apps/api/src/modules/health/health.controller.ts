import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('healthz')
  liveness(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('readyz')
  async readiness(): Promise<{
    status: 'ok';
    checks: { db: 'ok' };
    timestamp: string;
  }> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks: { db: 'down' },
      });
    }
    return {
      status: 'ok',
      checks: { db: 'ok' },
      timestamp: new Date().toISOString(),
    };
  }
}
