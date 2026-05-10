import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserDto } from '@archlens/shared-types';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      githubUsername: user.githubUsername,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
