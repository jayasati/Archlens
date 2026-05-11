import type { SmellDefinitionDto } from '@archlens/shared-types';
import { apiFetch, serverApiFetch } from './client';

const PATH = '/smells/catalog';

export function getSmellCatalog(): Promise<SmellDefinitionDto[]> {
  return apiFetch<SmellDefinitionDto[]>(PATH);
}

export function getSmellCatalogServer(): Promise<SmellDefinitionDto[]> {
  return serverApiFetch<SmellDefinitionDto[]>(PATH);
}
