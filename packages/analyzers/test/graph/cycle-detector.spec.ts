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

  it('finds a 2-node cycle and emits both edges and a closed path', () => {
    const g = buildModuleGraph(
      ['A', 'B'],
      [
        { from: 'A', to: 'B', kind: 'import' },
        { from: 'B', to: 'A', kind: 'import' },
      ]
    );
    const cycles = detectCycles(g);
    expect(cycles).toHaveLength(1);
    const c = cycles[0]!;
    expect(c.nodes.sort()).toEqual(['A', 'B']);
    expect(c.edges.sort((a, b) => a.from.localeCompare(b.from))).toEqual([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ]);
    expect(c.representativePath[0]).toBe(c.representativePath[c.representativePath.length - 1]);
    expect(c.representativePath.length).toBe(3);
  });

  it('detects self-loops and represents them as a 1-node loop', () => {
    const g = buildModuleGraph(['A'], [{ from: 'A', to: 'A', kind: 'import' }]);
    const cycles = detectCycles(g);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.nodes).toEqual(['A']);
    expect(cycles[0]!.edges).toEqual([{ from: 'A', to: 'A' }]);
    expect(cycles[0]!.representativePath).toEqual(['A', 'A']);
  });

  it('representativePath only traverses real edges (no fake adjacency)', () => {
    // SCC across 4 nodes but with only specific edges:
    // A -> B, B -> C, C -> A, A -> D, D -> A
    // (No direct B → D or C → D edge — the old code would have joined SCC
    //  members in pop order which could put B next to D with no real edge.)
    const g = buildModuleGraph(
      ['A', 'B', 'C', 'D'],
      [
        { from: 'A', to: 'B', kind: 'import' },
        { from: 'B', to: 'C', kind: 'import' },
        { from: 'C', to: 'A', kind: 'import' },
        { from: 'A', to: 'D', kind: 'import' },
        { from: 'D', to: 'A', kind: 'import' },
      ]
    );
    const cycles = detectCycles(g);
    expect(cycles).toHaveLength(1);
    const c = cycles[0]!;
    const realEdges = new Set(c.edges.map((e) => `${e.from} ${e.to}`));
    // Every adjacent pair in representativePath must be a real edge.
    for (let i = 0; i < c.representativePath.length - 1; i++) {
      const from = c.representativePath[i]!;
      const to = c.representativePath[i + 1]!;
      expect(realEdges.has(`${from} ${to}`), `${from} → ${to} must be a real edge`).toBe(true);
    }
    // And the loop must close.
    expect(c.representativePath[0]).toBe(c.representativePath[c.representativePath.length - 1]);
  });

  it('prefers the shortest cycle when several exist', () => {
    // Two cycles inside one SCC: A↔B (length 2) and A→C→D→A (length 3).
    const g = buildModuleGraph(
      ['A', 'B', 'C', 'D'],
      [
        { from: 'A', to: 'B', kind: 'import' },
        { from: 'B', to: 'A', kind: 'import' },
        { from: 'A', to: 'C', kind: 'import' },
        { from: 'C', to: 'D', kind: 'import' },
        { from: 'D', to: 'A', kind: 'import' },
      ]
    );
    const cycles = detectCycles(g);
    expect(cycles).toHaveLength(1);
    // 2-cycle representation has 3 entries (start, mid, start).
    expect(cycles[0]!.representativePath).toHaveLength(3);
  });
});
