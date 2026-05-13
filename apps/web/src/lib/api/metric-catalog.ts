import type { MetricDefinitionDto } from '@archlens/shared-types';
import { apiFetch, serverApiFetch } from './client';

const PATH = '/metrics/catalog';

export function getMetricCatalog(): Promise<MetricDefinitionDto[]> {
  return apiFetch<MetricDefinitionDto[]>(PATH);
}

export function getMetricCatalogServer(): Promise<MetricDefinitionDto[]> {
  return serverApiFetch<MetricDefinitionDto[]>(PATH);
}
