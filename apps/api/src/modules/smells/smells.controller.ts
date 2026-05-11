import { Controller, Get } from '@nestjs/common';
import { SMELL_CATALOG, type SmellDefinitionDto } from '@archlens/shared-types';
import { Public } from '../../common/decorators/public.decorator';

@Controller('smells')
export class SmellsController {
  /**
   * Returns the catalog of every smell rule the platform can detect.
   * Public endpoint — the catalog is metadata, not user data.
   *
   * To add a new entry: edit SMELL_CATALOG in @archlens/shared-types and
   * implement the matching detector in @archlens/analyzers. The /smells
   * page in the web app picks it up automatically.
   */
  @Public()
  @Get('catalog')
  catalog(): SmellDefinitionDto[] {
    return [...SMELL_CATALOG];
  }
}
