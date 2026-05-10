import { describe, expect, it } from 'vitest';
import { IR_VERSION, validateIR, type Grade, type Repo } from '@archlens/ir-schema';
import {
  SCAN_EVENTS,
  type ArchitectureDto,
  type HotspotDto,
  type PrCheckDto,
  type ReportSummaryDto,
  type ScanDto,
  type ScanEvent,
} from '../src/index.js';

const sampleIR: Repo = {
  ir_version: IR_VERSION,
  id: 'repo_42',
  name: 'sample',
  scannedAt: '2026-05-10T00:00:00.000Z',
  languages: ['typescript'],
  modules: [
    {
      id: 'mod_a',
      name: 'a',
      virtual: false,
      files: [
        {
          id: 'file_a',
          path: 'a.ts',
          language: 'typescript',
          loc: 12,
          classes: [],
          functions: [],
          smells: [],
        },
      ],
    },
  ],
  edges: [],
  scoreBreakdown: {
    complexity: 80,
    duplication: 90,
    coupling: 70,
    cohesion: 75,
    smells: 85,
    overall: 80,
  },
  grade: 'B',
};

describe('shared-types DTOs', () => {
  it('ScanDto round-trips through JSON', () => {
    const scan: ScanDto = {
      id: 'scan_1',
      repoId: 'repo_42',
      status: 'completed',
      createdAt: '2026-05-10T00:00:00.000Z',
      finishedAt: '2026-05-10T00:01:00.000Z',
      reportId: 'report_1',
    };
    const round = JSON.parse(JSON.stringify(scan)) as ScanDto;
    expect(round).toEqual(scan);
    expect(round.status).toBe('completed');
  });

  it('ReportSummaryDto carries IR types from ir-schema', () => {
    const validated = validateIR(sampleIR);
    const grade: Grade = validated.grade;

    const summary: ReportSummaryDto = {
      id: 'report_1',
      scanId: 'scan_1',
      repoId: validated.id,
      ir_version: validated.ir_version,
      grade,
      scoreBreakdown: validated.scoreBreakdown,
      counts: { modules: 1, files: 1, classes: 0, functions: 0, smells: 0 },
      topSmells: [],
      generatedAt: '2026-05-10T00:01:00.000Z',
    };
    expect(summary.ir_version).toBe(IR_VERSION);
    expect(summary.grade).toBe('B');
  });

  it('ArchitectureDto edges match ir-schema Edge shape', () => {
    const arch: ArchitectureDto = {
      reportId: 'report_1',
      repoId: 'repo_42',
      modules: [{ id: 'mod_a', name: 'a', fileCount: 1, virtual: false, grade: 'B' }],
      edges: [{ from: 'mod_a', to: 'mod_a', kind: 'reference', weight: 1 }],
      diagram: { format: 'mermaid', source: 'graph TD; A-->A;' },
      cycles: [],
    };
    const round = JSON.parse(JSON.stringify(arch)) as ArchitectureDto;
    expect(round.edges[0]?.kind).toBe('reference');
    expect(round.diagram.format).toBe('mermaid');
  });

  it('HotspotDto holds risk metrics', () => {
    const hot: HotspotDto = {
      fileId: 'file_a',
      path: 'a.ts',
      complexity: 12,
      churn: 3,
      riskScore: 27,
      smellCount: 1,
    };
    expect(hot.riskScore).toBe(27);
  });

  it('PrCheckDto encodes a score delta', () => {
    const check: PrCheckDto = {
      id: 'check_1',
      repoId: 'repo_42',
      scanId: 'scan_1',
      prNumber: 7,
      status: 'success',
      baseScore: 70,
      headScore: 80,
      delta: 10,
      baseGrade: 'C',
      headGrade: 'B',
      newSmells: 0,
      removedSmells: 2,
    };
    expect(check.delta).toBe(check.headScore - check.baseScore);
  });

  it('ScanEvent discriminated union narrows by type', () => {
    const events: ScanEvent[] = [
      { type: SCAN_EVENTS.Queued, scanId: 's1', at: 'now' },
      { type: SCAN_EVENTS.Started, scanId: 's1', at: 'now' },
      { type: SCAN_EVENTS.Progress, scanId: 's1', step: 'clone', percent: 12, at: 'now' },
      { type: SCAN_EVENTS.Completed, scanId: 's1', reportId: 'r1', at: 'now' },
      { type: SCAN_EVENTS.Failed, scanId: 's1', error: 'boom', at: 'now' },
    ];
    const completed = events.find((e) => e.type === SCAN_EVENTS.Completed);
    if (completed?.type === SCAN_EVENTS.Completed) {
      expect(completed.reportId).toBe('r1');
    } else {
      throw new Error('expected completed event');
    }
  });
});
