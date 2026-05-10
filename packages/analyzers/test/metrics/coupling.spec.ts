import { describe, expect, it } from 'vitest';
import { computeCoupling } from '../../src/metrics/coupling.js';

describe('computeCoupling', () => {
  it('counts fan-in and fan-out, ignoring self-loops', () => {
    const result = computeCoupling([
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'C' },
    ]);
    expect(result.fanOut.get('A')).toBe(2);
    expect(result.fanOut.get('B')).toBe(1);
    expect(result.fanOut.get('C')).toBeUndefined();
    expect(result.fanIn.get('B')).toBe(1);
    expect(result.fanIn.get('C')).toBe(2);
  });
});
