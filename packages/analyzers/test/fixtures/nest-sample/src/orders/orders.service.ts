import { Injectable } from '@nestjs/common';
import { UsersService } from '@app/users/users.service';

@Injectable()
export class OrdersService {
  constructor(private readonly usersService: UsersService) {}

  findAll() {
    return [{ id: 'o1', userId: '1' }];
  }

  countForUser(userId: string): number {
    const all = this.usersService.findAll();
    return all.filter((u) => u.id === userId).length;
  }
}
