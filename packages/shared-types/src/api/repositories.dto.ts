export type RepoProvider = 'github';

export interface RepositoryDto {
  id: string;
  provider: RepoProvider;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  connectedAt: string;
}

export interface CreateRepositoryRequestDto {
  provider?: RepoProvider;
  owner: string;
  name: string;
  defaultBranch?: string;
  private?: boolean;
  htmlUrl?: string;
}
