import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { OrdersService } from '@app/orders/orders.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService
  ) {}

  findAll() {
    return [{ id: '1', name: 'Ada' }];
  }

  findOne(id: string) {
    const orderCount = this.ordersService.countForUser(id);
    return { id, name: 'Ada', orderCount };
  }
}
