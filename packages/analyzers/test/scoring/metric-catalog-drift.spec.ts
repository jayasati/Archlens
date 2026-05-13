import { describe, expect, it } from 'vitest';
import { METRIC_CATALOG, type MetricId } from '@archlens/shared-types';
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from '../../src/scoring/weights.default.js';

/**
 * Keeps METRIC_CATALOG (shared-types) honest against the analyzer constants
 * it documents. If anyone edits DEFAULT_WEIGHTS or DEFAULT_THRESHOLDS without
 * also updating the catalog, this test fails loud — so the /metrics page never
 * lies to users about formula inputs.
 */
describe('METRIC_CATALOG drift guard', () => {
  it('covers exactly the four scored dimensions', () => {
    const ids = METRIC_CATALOG.map((m) => m.metricId).sort();
    expect(ids).toEqual(['cohesion', 'complexity', 'coupling', 'duplication']);
  });

  it.each(METRIC_CATALOG.map((m) => [m.metricId, m] as const))(
    'weight for %s matches DEFAULT_WEIGHTS',
    (metricId, definition) => {
      const expected = DEFAULT_WEIGHTS[metricId as MetricId];
      expect(definition.weight).toBe(expected);
    }
  );

  it('every threshold referenced in the catalog matches DEFAULT_THRESHOLDS', () => {
    type ThresholdKey = keyof typeof DEFAULT_THRESHOLDS;
    const thresholdKeys = new Set<string>(Object.keys(DEFAULT_THRESHOLDS));

    for (const metric of METRIC_CATALOG) {
      for (const t of metric.thresholdsUsed) {
        // Some catalog entries reference non-DEFAULT_THRESHOLDS knobs (e.g.
        // jscpd.minTokens). Skip those — only validate ones that ARE in
        // DEFAULT_THRESHOLDS so users can trust those values are live.
        if (!thresholdKeys.has(t.name)) continue;
        const expected = DEFAULT_THRESHOLDS[t.name as ThresholdKey];
        expect(t.value, `${metric.metricId}.thresholdsUsed[${t.name}]`).toBe(expected);
      }
    }
  });

  it('every catalog entry references at least one band that covers [0, 100]', () => {
    for (const metric of METRIC_CATALOG) {
      let minSeen = Infinity;
      let maxSeen = -Infinity;
      for (const band of metric.bands) {
        if (band.min < minSeen) minSeen = band.min;
        if (band.max > maxSeen) maxSeen = band.max;
      }
      expect(minSeen, `${metric.metricId} bands min`).toBe(0);
      expect(maxSeen, `${metric.metricId} bands max`).toBe(100);
    }
  });

  it('optimal target sits inside the score range', () => {
    for (const metric of METRIC_CATALOG) {
      expect(metric.optimal.min).toBeGreaterThanOrEqual(0);
      expect(metric.optimal.min).toBeLessThanOrEqual(100);
    }
  });
});
