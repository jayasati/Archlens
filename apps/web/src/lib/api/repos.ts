import type { CreateRepositoryRequestDto, RepositoryDto } from '@archlens/shared-types';
import { apiFetch, serverApiFetch, type ApiRequestOptions } from './client';

export function listRepos(token: string | null): Promise<RepositoryDto[]> {
  return apiFetch<RepositoryDto[]>('/repositories', { token });
}

export function listReposServer(token: string): Promise<RepositoryDto[]> {
  return serverApiFetch<RepositoryDto[]>('/repositories', { token });
}

export function getRepoById(token: string | null, id: string): Promise<RepositoryDto> {
  return apiFetch<RepositoryDto>(`/repositories/${id}`, { token });
}

export function createRepo(
  token: string | null,
  body: CreateRepositoryRequestDto
): Promise<RepositoryDto> {
  return apiFetch<RepositoryDto>('/repositories', { method: 'POST', body, token });
}

export function deleteRepo(token: string | null, id: string): Promise<void> {
  return apiFetch<void>(`/repositories/${id}`, { method: 'DELETE', token });
}

export async function findRepoByOwnerAndName(
  token: string,
  owner: string,
  name: string,
  fetcher: (path: string, opts: ApiRequestOptions) => Promise<RepositoryDto[]> = serverApiFetch
): Promise<RepositoryDto | null> {
  const repos = await fetcher('/repositories', { token });
  return (
    repos.find(
      (r) =>
        r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase()
    ) ?? null
  );
}
