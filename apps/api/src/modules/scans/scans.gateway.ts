import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type IORedis from 'ioredis';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload, ScanEvent } from '@archlens/shared-types';

import type { AppConfig } from '../../config/config.types';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_SUB_TOKEN } from './redis-subscriber.provider';

const REDIS_PATTERN = 'archlens:scan:*';
const CHANNEL_PREFIX = 'archlens:scan:';

interface AuthedSocket extends Socket {
  data: { userId?: string };
}

@Injectable()
@WebSocketGateway({
  namespace: '/scans',
  cors: { origin: true, credentials: true },
})
export class ScansGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(ScansGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(REDIS_SUB_TOKEN) private readonly subscriber: IORedis,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService
  ) {}

  async afterInit(): Promise<void> {
    await this.subscriber.psubscribe(REDIS_PATTERN);
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      this.handlePMessage(channel, message);
    });
    this.logger.log(`Subscribed to Redis pattern ${REDIS_PATTERN}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.punsubscribe(REDIS_PATTERN).catch(() => undefined);
    this.subscriber.disconnect();
  }

  handleConnection(client: AuthedSocket): void {
    const token = this.extractToken(client);
    if (!token) {
      client.emit('error', { message: 'Missing auth token' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      client.data.userId = payload.sub;
    } catch {
      client.emit('error', { message: 'Invalid auth token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Socket.io cleans up rooms automatically.
  }

  /**
   * Client subscribes to a specific scan. We verify ownership before
   * joining the room so a user can't snoop on another user's scans.
   */
  @SubscribeMessage('subscribe')
  async onSubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { scanId?: string } | undefined
  ): Promise<{ ok: true; scanId: string }> {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Unauthorized');
    const scanId = body?.scanId;
    if (!scanId || typeof scanId !== 'string') throw new WsException('scanId required');

    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { repository: { select: { userId: true } } },
    });
    if (!scan || scan.repository.userId !== userId) throw new WsException('Forbidden');

    await client.join(this.roomFor(scanId));
    return { ok: true, scanId };
  }

  @SubscribeMessage('unsubscribe')
  async onUnsubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { scanId?: string } | undefined
  ): Promise<{ ok: true }> {
    if (body?.scanId) await client.leave(this.roomFor(body.scanId));
    return { ok: true };
  }

  private handlePMessage(channel: string, message: string): void {
    if (!channel.startsWith(CHANNEL_PREFIX)) return;
    const scanId = channel.slice(CHANNEL_PREFIX.length);
    let event: ScanEvent;
    try {
      event = JSON.parse(message) as ScanEvent;
    } catch {
      this.logger.warn(`Discarding malformed scan event on ${channel}`);
      return;
    }
    this.server.to(this.roomFor(scanId)).emit('scan-event', event);
  }

  private roomFor(scanId: string): string {
    return `scan:${scanId}`;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice('Bearer '.length);
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;
    return null;
  }
}
