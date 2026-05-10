import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Scan } from '@prisma/client';
import type { ScanDto, ScanStatus } from '@archlens/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../queue/queue.service';
import type { CreateScanInput } from './dto/create-scan.schema';

@Injectable()
export class ScansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService
  ) {}

  async create(userId: string, input: CreateScanInput): Promise<ScanDto> {
    const repo = await this.prisma.repository.findFirst({
      where: { id: input.repoId, userId },
    });
    if (!repo) throw new NotFoundException('Repository not found');

    const cloneUrl = input.cloneUrl ?? repo.htmlUrl ?? `https://github.com/${repo.fullName}.git`;

    const scan = await this.prisma.scan.create({
      data: {
        repoId: repo.id,
        cloneUrl,
        ref: input.ref ?? repo.defaultBranch,
        status: 'queued',
      },
    });

    await this.queue.enqueueScan({
      scanId: scan.id,
      repoId: scan.repoId,
      cloneUrl: scan.cloneUrl,
      ref: scan.ref ?? undefined,
    });

    return this.toDto(scan);
  }

  async findOne(userId: string, id: string): Promise<ScanDto> {
    const scan = await this.prisma.scan.findUnique({
      where: { id },
      include: { repository: true, report: { select: { id: true } } },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.repository.userId !== userId) throw new ForbiddenException();
    return this.toDto(scan, scan.report?.id);
  }

  async list(userId: string, repoId?: string): Promise<ScanDto[]> {
    const repoFilter = repoId ? { id: repoId, userId } : { userId };
    const repos = await this.prisma.repository.findMany({
      where: repoFilter,
      select: { id: true },
    });
    const repoIds = repos.map((r) => r.id);
    if (repoIds.length === 0) return [];

    const scans = await this.prisma.scan.findMany({
      where: { repoId: { in: repoIds } },
      orderBy: { createdAt: 'desc' },
      include: { report: { select: { id: true } } },
    });
    return scans.map((s) => this.toDto(s, s.report?.id));
  }

  private toDto(scan: Scan, reportId?: string): ScanDto {
    const dto: ScanDto = {
      id: scan.id,
      repoId: scan.repoId,
      status: scan.status as ScanStatus,
      createdAt: scan.createdAt.toISOString(),
    };
    if (scan.startedAt) dto.startedAt = scan.startedAt.toISOString();
    if (scan.finishedAt) dto.finishedAt = scan.finishedAt.toISOString();
    if (scan.progressStep || scan.progressPct > 0) {
      dto.progress = {
        step: scan.progressStep ?? 'queued',
        percent: scan.progressPct,
      };
    }
    if (reportId) dto.reportId = reportId;
    if (scan.error) dto.error = scan.error;
    return dto;
  }
}
