import { describe, expect, it } from 'vitest';
import { buildModuleGraph } from '../../src/graph/graph-builder.js';
import { detectCycles } from '../../src/graph/cycle-detector.js';

describe('detectCycles', () => {
  it('finds nothing in a DAG', () => {
    const g = buildModuleGraph(
      ['A', 'B', 'C'],
      [
        { from: 'A', to: 'B', kind: 'import' },
        { from: 'B', to: 'C', kind: 'import' },
      ]
    );
    expect(detectCycles(g)).toHaveLength(0);
  });

  it('finds a 2-node cycle', () => {
    const g = buildModuleGraph(
      ['A', 'B'],
      [
        { from: 'A', to: 'B', kind: 'import' },
        { from: 'B', to: 'A', kind: 'import' },
      ]
    );
    const cycles = detectCycles(g);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.nodes.sort()).toEqual(['A', 'B']);
  });

  it('detects self-loops', () => {
    const g = buildModuleGraph(['A'], [{ from: 'A', to: 'A', kind: 'import' }]);
    const cycles = detectCycles(g);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.nodes).toEqual(['A']);
  });
});
