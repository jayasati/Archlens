import { describe, it, expect } from 'vitest';
import type { MetricDefinitionDto, Smell, SmellDefinitionDto } from '@archlens/shared-types';
import { pickMitigations } from '@/components/metrics/rating-tile-expandable';

const COMPLEXITY_METRIC = {
  metricId: 'complexity',
  name: 'Complexity',
  shortDescription: '',
  description: '',
  weight: 0.25,
  formula: [],
  scoreDerivation: '',
  inputs: [],
  bands: [],
  optimal: { min: 85, rationale: '' },
  improvementPlaybook: [],
  relatedSmells: ['long-method', 'excessive-complexity', 'deep-nesting', 'god-function'],
  thresholdsUsed: [],
} as unknown as MetricDefinitionDto;

const COUPLING_METRIC = {
  ...COMPLEXITY_METRIC,
  metricId: 'coupling',
  relatedSmells: ['cyclic-dependencies', 'hub-dependency'],
} as unknown as MetricDefinitionDto;

const CATALOG: SmellDefinitionDto[] = [
  {
    ruleId: 'long-method',
    kind: 'long-method',
    name: 'Long method',
    shortDescription: '',
    description: '',
    category: 'size',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation: 'Extract sub-routines for cohesive blocks.',
  },
  {
    ruleId: 'deep-nesting',
    kind: 'deep-nesting',
    name: 'Deep nesting',
    shortDescription: '',
    description: '',
    category: 'complexity',
    defaultSeverity: 'minor',
    languages: ['all'],
    remediation: 'Replace nested if/else pyramids with early-return guards.',
  },
];

function smell(overrides: Partial<Smell> & Pick<Smell, 'id' | 'ruleId' | 'severity'>): Smell {
  return {
    kind: overrides.ruleId,
    message: overrides.message ?? 'placeholder',
    file: overrides.file ?? 'src/example.ts',
    location: overrides.location ?? { startLine: 10, endLine: 20 },
    ...overrides,
  } as Smell;
}

describe('pickMitigations', () => {
  it('filters smells to the metric.relatedSmells set', () => {
    const smells = [
      smell({ id: 's1', ruleId: 'long-method', severity: 'major' }),
      smell({ id: 's2', ruleId: 'hub-dependency', severity: 'critical' }),
      smell({ id: 's3', ruleId: 'deep-nesting', severity: 'minor' }),
    ];
    const out = pickMitigations(COMPLEXITY_METRIC, smells, CATALOG);
    const ruleIds = out.map((m) => m.ruleId);
    expect(ruleIds).toContain('long-method');
    expect(ruleIds).toContain('deep-nesting');
    expect(ruleIds).not.toContain('hub-dependency');
  });

  it('sorts by severity (critical → major → minor → info)', () => {
    const smells = [
      smell({ id: 's-minor', ruleId: 'long-method', severity: 'minor' }),
      smell({ id: 's-crit', ruleId: 'long-method', severity: 'critical' }),
      smell({ id: 's-major', ruleId: 'long-method', severity: 'major' }),
    ];
    const out = pickMitigations(COMPLEXITY_METRIC, smells, CATALOG);
    expect(out.map((m) => m.severity)).toEqual(['critical', 'major', 'minor']);
  });

  it('caps the list at 5 even when more match', () => {
    const smells = Array.from({ length: 10 }, (_, i) =>
      smell({ id: `s${i}`, ruleId: 'long-method', severity: 'minor' })
    );
    expect(pickMitigations(COMPLEXITY_METRIC, smells, CATALOG)).toHaveLength(5);
  });

  it('formats single-line locations as file:line and ranges as file:start-end', () => {
    const single = smell({
      id: 's-single',
      ruleId: 'long-method',
      severity: 'major',
      file: 'src/a.ts',
      location: { startLine: 7, endLine: 7 },
    });
    const ranged = smell({
      id: 's-range',
      ruleId: 'long-method',
      severity: 'major',
      file: 'src/b.ts',
      location: { startLine: 7, endLine: 42 },
    });
    const out = pickMitigations(COMPLEXITY_METRIC, [single, ranged], CATALOG);
    const byId = new Map(out.map((m) => [m.id, m]));
    expect(byId.get('s-single')!.location).toBe('src/a.ts:7');
    expect(byId.get('s-range')!.location).toBe('src/b.ts:7-42');
  });

  it('falls back gracefully when a smell has no location', () => {
    const noLoc = smell({
      id: 's-noloc',
      ruleId: 'long-method',
      severity: 'major',
      file: 'src/c.ts',
    });
    delete (noLoc as { location?: unknown }).location;
    const out = pickMitigations(COMPLEXITY_METRIC, [noLoc], CATALOG);
    expect(out[0]!.location).toBe('src/c.ts');
  });

  it('attaches catalog.remediation when the rule is known, null otherwise', () => {
    const known = smell({ id: 's-known', ruleId: 'long-method', severity: 'major' });
    const unknown = smell({ id: 's-unknown', ruleId: 'god-function', severity: 'major' });
    const out = pickMitigations(COMPLEXITY_METRIC, [known, unknown], CATALOG);
    const byId = new Map(out.map((m) => [m.id, m]));
    expect(byId.get('s-known')!.remediation).toBe('Extract sub-routines for cohesive blocks.');
    expect(byId.get('s-unknown')!.remediation).toBeNull();
  });

  it('returns an empty list when the metric defines no relatedSmells', () => {
    const empty = { ...COMPLEXITY_METRIC, relatedSmells: [] } as MetricDefinitionDto;
    const smells = [smell({ id: 's1', ruleId: 'long-method', severity: 'major' })];
    expect(pickMitigations(empty, smells, CATALOG)).toEqual([]);
  });

  it('uses the metrics own relatedSmells for filtering (sanity)', () => {
    const smells = [
      smell({ id: 's1', ruleId: 'long-method', severity: 'major' }),
      smell({ id: 's2', ruleId: 'cyclic-dependencies', severity: 'critical' }),
    ];
    const complexity = pickMitigations(COMPLEXITY_METRIC, smells, CATALOG);
    const coupling = pickMitigations(COUPLING_METRIC, smells, CATALOG);
    expect(complexity.map((m) => m.ruleId)).toEqual(['long-method']);
    expect(coupling.map((m) => m.ruleId)).toEqual(['cyclic-dependencies']);
  });
});
