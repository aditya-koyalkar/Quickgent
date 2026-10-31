import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('health')
  async health() {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'unreachable';
    }

    let redisStatus = 'ok';
    try {
      const ping = await this.redis.ping();
      if (ping !== 'PONG') redisStatus = 'degraded';
    } catch {
      redisStatus = 'unreachable';
    }

    const overall = dbStatus === 'ok' ? 'ok' : 'degraded';

    return {
      status: overall,
      service: 'quickgent-api',
      database: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
