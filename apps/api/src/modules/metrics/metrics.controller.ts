import { Controller, Get } from '@nestjs/common';
import { METRIC_CATALOG, type MetricDefinitionDto } from '@archlens/shared-types';
import { Public } from '../../common/decorators/public.decorator';

@Controller('metrics')
export class MetricsController {
  /**
   * Returns the catalog of every scoring metric Archlens computes (cohesion,
   * coupling, duplication, complexity). Public — the catalog is metadata.
   *
   * To update an entry, edit METRIC_CATALOG in @archlens/shared-types. The
   * /metrics page in the web app and the per-repo expanders both pick up
   * changes automatically.
   */
  @Public()
  @Get('catalog')
  catalog(): MetricDefinitionDto[] {
    return [...METRIC_CATALOG];
  }
}
