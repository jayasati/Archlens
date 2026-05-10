import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import type { JwtPayload, UserDto } from '@archlens/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload | undefined): Promise<UserDto> {
    if (!user) throw new UnauthorizedException();
    return this.users.findById(user.sub);
  }
}
