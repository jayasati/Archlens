import { Module } from '@nestjs/common';
import { SmellsController } from './smells.controller';

@Module({
  controllers: [SmellsController],
})
export class SmellsModule {}
