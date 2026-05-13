import type {
  FixSuggestionDto,
  ReportFileDetailDto,
  ReportFileSourceDto,
  ReportModuleDetailDto,
  ReportModuleScoreDto,
  ReportSummaryDto,
} from '@archlens/shared-types';
import { apiFetch, serverApiFetch } from './client';

export function getReportSummary(token: string | null, scanId: string): Promise<ReportSummaryDto> {
  return apiFetch<ReportSummaryDto>(`/reports/${scanId}`, { token });
}

export function getReportSummaryServer(token: string, scanId: string): Promise<ReportSummaryDto> {
  return serverApiFetch<ReportSummaryDto>(`/reports/${scanId}`, { token });
}

export function listReportModules(
  token: string | null,
  scanId: string
): Promise<ReportModuleScoreDto[]> {
  return apiFetch<ReportModuleScoreDto[]>(`/reports/${scanId}/modules`, { token });
}

export function listReportModulesServer(
  token: string,
  scanId: string
): Promise<ReportModuleScoreDto[]> {
  return serverApiFetch<ReportModuleScoreDto[]>(`/reports/${scanId}/modules`, { token });
}

export function getReportModule(
  token: string | null,
  scanId: string,
  moduleId: string
): Promise<ReportModuleDetailDto> {
  return apiFetch<ReportModuleDetailDto>(`/reports/${scanId}/modules/${moduleId}`, { token });
}

export function getReportFile(
  token: string | null,
  scanId: string,
  filePath: string
): Promise<ReportFileDetailDto> {
  return apiFetch<ReportFileDetailDto>(`/reports/${scanId}/files/${encodeURIComponent(filePath)}`, {
    token,
  });
}

export function getReportFileSource(
  token: string | null,
  scanId: string,
  fileId: string
): Promise<ReportFileSourceDto> {
  return apiFetch<ReportFileSourceDto>(`/reports/${scanId}/files/${fileId}/source`, { token });
}

export function requestSmellFixSuggestion(
  token: string | null,
  scanId: string,
  smellId: string,
  options: { force?: boolean } = {}
): Promise<FixSuggestionDto> {
  return apiFetch<FixSuggestionDto>(`/reports/${scanId}/smells/${smellId}/suggest-fix`, {
    method: 'POST',
    token,
    query: options.force ? { force: 'true' } : undefined,
  });
}
