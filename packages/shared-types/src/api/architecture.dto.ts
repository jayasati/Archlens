import type { Edge, Grade } from '@archlens/ir-schema';

export interface ModuleSummaryDto {
  id: string;
  name: string;
  fileCount: number;
  virtual: boolean;
  grade?: Grade;
}

export interface DiagramDto {
  format: 'mermaid';
  source: string;
}

export interface ArchitectureDto {
  reportId: string;
  repoId: string;
  modules: ModuleSummaryDto[];
  edges: Edge[];
  diagram: DiagramDto;
  cycles: string[][];
}
