import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectDuplication } from '../../src/metrics/duplication.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '../fixtures/duplication-sample');

describe('detectDuplication', () => {
  it('finds the planted clone between copy-a and copy-b', async () => {
    const result = await detectDuplication(fixtureDir, {
      formats: ['typescript'],
      // Lower the minTokens floor; the planted fragment is small.
      minTokens: 15,
      // Pretend the fixture has 36 LOC so the ratio is meaningful.
      totalLoc: 36,
    });

    expect(result.clones.length).toBeGreaterThan(0);
    const clone = result.clones[0]!;
    expect(clone.format).toBe('typescript');
    expect(clone.locations).toHaveLength(2);
    const fileSet = new Set(clone.locations.map((l) => l.file));
    expect(fileSet.has('copy-a.ts')).toBe(true);
    expect(fileSet.has('copy-b.ts')).toBe(true);
    expect(result.duplicateLines).toBeGreaterThan(0);
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThanOrEqual(1);
  }, 30000);

  it('returns an empty result when nothing duplicates above the threshold', async () => {
    const result = await detectDuplication(fixtureDir, {
      formats: ['typescript'],
      // Push the floor above the planted clone size.
      minTokens: 500,
      totalLoc: 36,
    });
    expect(result.clones).toEqual([]);
    expect(result.duplicateLines).toBe(0);
    expect(result.ratio).toBe(0);
  }, 30000);
});
