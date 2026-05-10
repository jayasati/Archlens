import type {
  ReportFileDetailDto,
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
