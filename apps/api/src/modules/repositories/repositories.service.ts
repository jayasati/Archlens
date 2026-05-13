import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Repository } from '@prisma/client';
import type { RepositoryDto } from '@archlens/shared-types';
import { PrismaService } from '../../database/prisma.service';
import type { CreateRepositoryInput } from './dto/create-repository.schema';
import type { UpdateRepositoryInput } from './dto/update-repository.schema';

@Injectable()
export class RepositoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateRepositoryInput): Promise<RepositoryDto> {
    const fullName = `${input.owner}/${input.name}`;
    try {
      const repo = await this.prisma.repository.create({
        data: {
          userId,
          provider: input.provider,
          owner: input.owner,
          name: input.name,
          fullName,
          defaultBranch: input.defaultBranch,
          private: input.private,
          htmlUrl: input.htmlUrl ?? `https://github.com/${fullName}`,
        },
      });
      return this.toDto(repo);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Repository already connected');
      }
      throw e;
    }
  }

  async list(userId: string): Promise<RepositoryDto[]> {
    const rows = await this.prisma.repository.findMany({
      where: { userId },
      orderBy: { connectedAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(userId: string, id: string): Promise<RepositoryDto> {
    const repo = await this.prisma.repository.findFirst({
      where: { id, userId },
    });
    if (!repo) throw new NotFoundException('Repository not found');
    return this.toDto(repo);
  }

  async update(userId: string, id: string, input: UpdateRepositoryInput): Promise<RepositoryDto> {
    const result = await this.prisma.repository.updateMany({
      where: { id, userId },
      data: {
        ...(input.defaultBranch !== undefined && { defaultBranch: input.defaultBranch }),
        ...(input.private !== undefined && { private: input.private }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Repository not found');
    const repo = await this.prisma.repository.findFirst({ where: { id, userId } });
    if (!repo) throw new NotFoundException('Repository not found');
    return this.toDto(repo);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.repository.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Repository not found');
    }
  }

  private toDto(r: Repository): RepositoryDto {
    return {
      id: r.id,
      provider: r.provider as 'github',
      owner: r.owner,
      name: r.name,
      fullName: r.fullName,
      defaultBranch: r.defaultBranch,
      private: r.private,
      htmlUrl: r.htmlUrl ?? `https://github.com/${r.fullName}`,
      connectedAt: r.connectedAt.toISOString(),
    };
  }
}
