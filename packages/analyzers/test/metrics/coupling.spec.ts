import { describe, expect, it } from 'vitest';
import {
  computeCoupling,
  enrichModuleAbstractness,
  enrichModuleCoupling,
} from '../../src/metrics/coupling.js';

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

describe('enrichModuleCoupling', () => {
  it('stamps fanIn / fanOut / instability and returns hub summary', () => {
    const coupling = computeCoupling([
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'A', to: 'D' },
      { from: 'X', to: 'A' },
      { from: 'Y', to: 'A' },
    ]);
    type M = { id: string; fanIn?: number; fanOut?: number; instability?: number };
    const modules: M[] = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
      { id: 'X' },
      { id: 'Y' },
    ];
    const summary = enrichModuleCoupling(modules, coupling);
    // A: fanIn=2 (X, Y), fanOut=3 (B, C, D) → instability = 3/5 = 0.6
    const a = modules.find((m) => m.id === 'A')!;
    expect(a.fanIn).toBe(2);
    expect(a.fanOut).toBe(3);
    expect(a.instability).toBeCloseTo(0.6, 5);
    // dual-hub max should be A's 2 * 3 = 6
    expect(summary.dualHubMax).toBe(6);
    expect(summary.fanOutMax).toBe(3);
    // Leaf modules (no edges either direction) get fanIn/fanOut 0 and undefined instability.
    // In this graph everyone has at least one edge, so spot-check the pure consumers/providers.
    const b = modules.find((m) => m.id === 'B')!;
    expect(b.fanIn).toBe(1);
    expect(b.fanOut).toBe(0);
    expect(b.instability).toBe(0); // pure provider
  });

  it('treats truly isolated modules as having no signal', () => {
    const coupling = computeCoupling([]);
    const modules = [{ id: 'A' } as { id: string; instability?: number }];
    enrichModuleCoupling(modules, coupling);
    expect(modules[0]!.instability).toBeUndefined();
  });
});

describe('enrichModuleAbstractness', () => {
  it('stamps abstractness + martinDistance using existing instability', () => {
    const modules = [
      // stable provider, fully abstract → distance ≈ 0
      { id: 'iface', instability: 0, abstractness: undefined, martinDistance: undefined } as {
        id: string;
        instability?: number;
        abstractness?: number;
        martinDistance?: number;
      },
      // volatile consumer, fully concrete → distance ≈ 0
      { id: 'app', instability: 1, abstractness: undefined, martinDistance: undefined },
      // concrete + stable → "zone of pain" → distance ≈ 1
      { id: 'painful', instability: 0, abstractness: undefined, martinDistance: undefined },
    ];
    const typeCounts = new Map([
      ['iface', { total: 5, abstract: 5 }],
      ['app', { total: 5, abstract: 0 }],
      ['painful', { total: 5, abstract: 0 }],
    ]);
    enrichModuleAbstractness(modules, typeCounts);
    expect(modules[0]!.abstractness).toBe(1);
    expect(modules[0]!.martinDistance).toBeCloseTo(0, 5);
    expect(modules[1]!.abstractness).toBe(0);
    expect(modules[1]!.martinDistance).toBeCloseTo(0, 5);
    expect(modules[2]!.abstractness).toBe(0);
    expect(modules[2]!.martinDistance).toBeCloseTo(1, 5);
  });

  it('skips modules below the minTypes floor', () => {
    const modules = [
      { id: 'tiny', instability: 0.5, abstractness: undefined, martinDistance: undefined } as {
        id: string;
        instability?: number;
        abstractness?: number;
        martinDistance?: number;
      },
    ];
    const typeCounts = new Map([['tiny', { total: 2, abstract: 0 }]]);
    enrichModuleAbstractness(modules, typeCounts);
    expect(modules[0]!.abstractness).toBeUndefined();
    expect(modules[0]!.martinDistance).toBeUndefined();
  });
});
