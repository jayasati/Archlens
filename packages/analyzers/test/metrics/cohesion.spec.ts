import { describe, expect, it } from 'vitest';
import { computeModuleCohesion } from '../../src/metrics/cohesion.js';

describe('computeModuleCohesion', () => {
  it('scores a perfectly self-contained module as 1.0', () => {
    const fileEdges = [
      { fromFile: 'a/x.ts', toFile: 'a/y.ts' },
      { fromFile: 'a/y.ts', toFile: 'a/z.ts' },
    ];
    const fileToModule = new Map([
      ['a/x.ts', 'mod_a'],
      ['a/y.ts', 'mod_a'],
      ['a/z.ts', 'mod_a'],
    ]);
    const sizes = new Map([['mod_a', { loc: 30, fileCount: 3 }]]);

    const result = computeModuleCohesion(fileEdges, fileToModule, sizes);
    expect(result.ratios.get('mod_a')).toBe(1);
    expect(result.cohesionWeighted).toBe(30);
    expect(result.moduleLocSum).toBe(30);
  });

  it('scores a module whose imports all leave as 0.0', () => {
    const fileEdges = [
      { fromFile: 'a/x.ts', toFile: 'b/y.ts' },
      { fromFile: 'a/x.ts', toFile: 'c/z.ts' },
    ];
    const fileToModule = new Map([
      ['a/x.ts', 'mod_a'],
      ['a/other.ts', 'mod_a'],
      ['b/y.ts', 'mod_b'],
      ['c/z.ts', 'mod_c'],
    ]);
    const sizes = new Map([
      ['mod_a', { loc: 20, fileCount: 2 }],
      ['mod_b', { loc: 10, fileCount: 1 }],
      ['mod_c', { loc: 10, fileCount: 1 }],
    ]);

    const result = computeModuleCohesion(fileEdges, fileToModule, sizes);
    expect(result.ratios.get('mod_a')).toBe(0);
    // mod_b and mod_c are single-file, so skipped from the score
    expect(result.ratios.has('mod_b')).toBe(false);
    expect(result.ratios.has('mod_c')).toBe(false);
  });

  it('produces a fractional ratio for a mixed module', () => {
    const fileEdges = [
      { fromFile: 'a/x.ts', toFile: 'a/y.ts' }, // internal
      { fromFile: 'a/x.ts', toFile: 'b/z.ts' }, // external
      { fromFile: 'a/y.ts', toFile: 'b/z.ts' }, // external
    ];
    const fileToModule = new Map([
      ['a/x.ts', 'mod_a'],
      ['a/y.ts', 'mod_a'],
      ['b/z.ts', 'mod_b'],
      ['b/other.ts', 'mod_b'],
    ]);
    const sizes = new Map([
      ['mod_a', { loc: 100, fileCount: 2 }],
      ['mod_b', { loc: 50, fileCount: 2 }],
    ]);

    const result = computeModuleCohesion(fileEdges, fileToModule, sizes);
    expect(result.ratios.get('mod_a')).toBeCloseTo(1 / 3, 5);
  });

  it('skips single-file modules entirely', () => {
    const fileEdges = [{ fromFile: 'solo.ts', toFile: 'lib/x.ts' }];
    const fileToModule = new Map([
      ['solo.ts', 'mod_solo'],
      ['lib/x.ts', 'mod_lib'],
      ['lib/y.ts', 'mod_lib'],
    ]);
    const sizes = new Map([
      ['mod_solo', { loc: 10, fileCount: 1 }],
      ['mod_lib', { loc: 50, fileCount: 2 }],
    ]);

    const result = computeModuleCohesion(fileEdges, fileToModule, sizes);
    expect(result.ratios.has('mod_solo')).toBe(false);
    // mod_lib has no edges originating from it → no signal → also skipped
    expect(result.ratios.has('mod_lib')).toBe(false);
    expect(result.moduleLocSum).toBe(0);
  });

  it('skips leaf modules (no outgoing edges) from the average', () => {
    const fileEdges = [
      { fromFile: 'a/x.ts', toFile: 'a/y.ts' },
      // mod_b has 2 files but no outgoing edges
    ];
    const fileToModule = new Map([
      ['a/x.ts', 'mod_a'],
      ['a/y.ts', 'mod_a'],
      ['b/p.ts', 'mod_b'],
      ['b/q.ts', 'mod_b'],
    ]);
    const sizes = new Map([
      ['mod_a', { loc: 40, fileCount: 2 }],
      ['mod_b', { loc: 80, fileCount: 2 }],
    ]);

    const result = computeModuleCohesion(fileEdges, fileToModule, sizes);
    expect(result.ratios.has('mod_a')).toBe(true);
    expect(result.ratios.has('mod_b')).toBe(false); // no signal
    expect(result.moduleLocSum).toBe(40); // only mod_a contributes
  });

  it('LOC-weights the repo-wide aggregate', () => {
    const fileEdges = [
      // mod_big (loc 1000): 1 internal, 1 external → ratio 0.5
      { fromFile: 'big/x.ts', toFile: 'big/y.ts' },
      { fromFile: 'big/x.ts', toFile: 'small/p.ts' },
      // mod_small (loc 10): 1 internal, 0 external → ratio 1.0
      { fromFile: 'small/p.ts', toFile: 'small/q.ts' },
    ];
    const fileToModule = new Map([
      ['big/x.ts', 'mod_big'],
      ['big/y.ts', 'mod_big'],
      ['small/p.ts', 'mod_small'],
      ['small/q.ts', 'mod_small'],
    ]);
    const sizes = new Map([
      ['mod_big', { loc: 1000, fileCount: 2 }],
      ['mod_small', { loc: 10, fileCount: 2 }],
    ]);

    const result = computeModuleCohesion(fileEdges, fileToModule, sizes);
    // weighted = 0.5 * 1000 + 1.0 * 10 = 510; total = 1010 → ≈ 0.505
    const weightedAvg = result.cohesionWeighted / result.moduleLocSum;
    expect(weightedAvg).toBeCloseTo(510 / 1010, 4);
  });
});
