import { describe, expect, it } from 'vitest';
import { detectGodClass } from '../../src/metrics/smells/god-class.js';
import { detectLongMethod } from '../../src/metrics/smells/long-method.js';
import { detectDeepNesting } from '../../src/metrics/smells/deep-nesting.js';
import { detectLongParameterList } from '../../src/metrics/smells/long-parameter-list.js';
import { detectExcessiveComplexity } from '../../src/metrics/smells/excessive-complexity.js';
import { detectHighWmc } from '../../src/metrics/smells/high-wmc.js';
import { detectLowCohesion } from '../../src/metrics/smells/low-cohesion.js';
import { detectHubDependency } from '../../src/metrics/smells/hub-dependency.js';
import { detectDataClass } from '../../src/metrics/smells/data-class.js';
import { detectLazyClass } from '../../src/metrics/smells/lazy-class.js';
import { detectPrimitiveObsession } from '../../src/metrics/smells/primitive-obsession.js';
import { detectGodFunction } from '../../src/metrics/smells/god-function.js';
import { detectCommentedOutCode } from '../../src/metrics/smells/commented-out-code.js';
import { detectTodoAccumulation } from '../../src/metrics/smells/todo-accumulation.js';
import { detectCyclicDependencies } from '../../src/metrics/smells/cyclic-dependencies.js';
import { detectUnstableDependency } from '../../src/metrics/smells/unstable-dependency.js';
import { detectGodPackage } from '../../src/metrics/smells/god-package.js';
import { detectScatteredFunctionality } from '../../src/metrics/smells/scattered-functionality.js';
import { detectCrossLayerSkip } from '../../src/metrics/smells/cross-layer-skip.js';

describe('long-method detector', () => {
  it('flags by LOC', () => {
    const smell = detectLongMethod(
      {
        filePath: 'a.py',
        name: 'foo',
        startLine: 1,
        endLine: 60,
        loc: 60,
        complexity: 2,
      },
      { loc: 30, complexity: 10 }
    );
    expect(smell?.kind).toBe('long-method');
    expect(smell?.severity).toBe('major');
  });

  it('returns null for short, simple methods', () => {
    const smell = detectLongMethod(
      { filePath: 'a.py', name: 'foo', startLine: 1, endLine: 5, loc: 5, complexity: 2 },
      { loc: 30, complexity: 10 }
    );
    expect(smell).toBeNull();
  });
});

describe('god-class detector', () => {
  it('flags classes with many methods', () => {
    const smell = detectGodClass(
      {
        filePath: 'a.py',
        name: 'Big',
        startLine: 1,
        endLine: 200,
        loc: 200,
        methodCount: 15,
        attributeCount: 4,
      },
      { methods: 10, loc: 200 }
    );
    expect(smell?.kind).toBe('god-class');
  });

  it('skips small cohesive classes', () => {
    const smell = detectGodClass(
      {
        filePath: 'a.py',
        name: 'Small',
        startLine: 1,
        endLine: 20,
        loc: 20,
        methodCount: 3,
        attributeCount: 2,
      },
      { methods: 10, loc: 200 }
    );
    expect(smell).toBeNull();
  });
});

describe('deep-nesting detector', () => {
  it('flags methods exceeding the depth threshold', () => {
    const smell = detectDeepNesting(
      {
        filePath: 'a.py',
        name: 'foo',
        startLine: 1,
        endLine: 30,
        maxNestingDepth: 6,
      },
      { depth: 4 }
    );
    expect(smell?.kind).toBe('deep-nesting');
    expect(smell?.severity).toBe('major');
  });

  it('skips shallow methods', () => {
    const smell = detectDeepNesting(
      {
        filePath: 'a.py',
        name: 'foo',
        startLine: 1,
        endLine: 5,
        maxNestingDepth: 2,
      },
      { depth: 4 }
    );
    expect(smell).toBeNull();
  });
});

describe('long-parameter-list detector', () => {
  it('flags functions over the parameter threshold', () => {
    const s = detectLongParameterList(
      { filePath: 'a.py', name: 'f', startLine: 1, endLine: 2, paramCount: 6 },
      { count: 5 }
    );
    expect(s?.kind).toBe('long-parameter-list');
  });
  it('skips short signatures', () => {
    const s = detectLongParameterList(
      { filePath: 'a.py', name: 'f', startLine: 1, endLine: 2, paramCount: 3 },
      { count: 5 }
    );
    expect(s).toBeNull();
  });
});

describe('excessive-complexity detector', () => {
  it('flags complex functions', () => {
    const s = detectExcessiveComplexity(
      { filePath: 'a.py', name: 'f', startLine: 1, endLine: 80, complexity: 20 },
      { complexity: 15 }
    );
    expect(s?.severity).toBe('major');
  });
  it('escalates to critical past 2× threshold', () => {
    const s = detectExcessiveComplexity(
      { filePath: 'a.py', name: 'f', startLine: 1, endLine: 80, complexity: 40 },
      { complexity: 15 }
    );
    expect(s?.severity).toBe('critical');
  });
  it('skips simple functions', () => {
    const s = detectExcessiveComplexity(
      { filePath: 'a.py', name: 'f', startLine: 1, endLine: 10, complexity: 3 },
      { complexity: 15 }
    );
    expect(s).toBeNull();
  });
});

describe('high-wmc detector', () => {
  it('flags classes with high summed complexity', () => {
    const s = detectHighWmc(
      {
        filePath: 'a.py',
        name: 'C',
        startLine: 1,
        endLine: 80,
        methodComplexities: [10, 12, 8, 25],
      },
      { wmc: 50 }
    );
    expect(s?.kind).toBe('high-wmc');
  });
  it('ignores classes with low total WMC', () => {
    const s = detectHighWmc(
      {
        filePath: 'a.py',
        name: 'C',
        startLine: 1,
        endLine: 20,
        methodComplexities: [2, 3, 4],
      },
      { wmc: 50 }
    );
    expect(s).toBeNull();
  });
});

describe('low-cohesion detector', () => {
  it('flags modules below the cohesion threshold', () => {
    const s = detectLowCohesion(
      {
        moduleId: 'mod_x',
        moduleName: 'x',
        cohesionRatio: 0.1,
        fileCount: 5,
        anchorFile: 'x/a.py',
      },
      { ratio: 0.3 }
    );
    expect(s?.kind).toBe('low-cohesion');
  });
  it('does not flag single-file modules (no signal)', () => {
    const s = detectLowCohesion(
      {
        moduleId: 'mod_x',
        moduleName: 'x',
        cohesionRatio: 0,
        fileCount: 1,
        anchorFile: 'x/a.py',
      },
      { ratio: 0.3 }
    );
    expect(s).toBeNull();
  });
});

describe('hub-dependency detector', () => {
  it('flags modules with high fan-in', () => {
    const s = detectHubDependency(
      { moduleId: 'mod_x', moduleName: 'x', fanIn: 12, anchorFile: 'x/a.py' },
      { fanIn: 8 }
    );
    expect(s?.kind).toBe('hub-dependency');
  });
  it('skips quiet modules', () => {
    const s = detectHubDependency(
      { moduleId: 'mod_x', moduleName: 'x', fanIn: 2, anchorFile: 'x/a.py' },
      { fanIn: 8 }
    );
    expect(s).toBeNull();
  });
});

describe('data-class detector', () => {
  it('flags attribute-only classes', () => {
    const s = detectDataClass(
      {
        filePath: 'a.py',
        name: 'Point',
        startLine: 1,
        endLine: 4,
        attributeCount: 3,
        methodNames: ['__init__', '__repr__'],
      },
      { maxMethods: 2 }
    );
    expect(s?.kind).toBe('data-class');
  });
  it('does not flag classes with real behaviour', () => {
    const s = detectDataClass(
      {
        filePath: 'a.py',
        name: 'Point',
        startLine: 1,
        endLine: 30,
        attributeCount: 2,
        methodNames: ['__init__', 'translate', 'scale', 'rotate'],
      },
      { maxMethods: 2 }
    );
    expect(s).toBeNull();
  });
});

describe('lazy-class detector', () => {
  it('flags tiny classes with few methods', () => {
    const s = detectLazyClass(
      {
        filePath: 'a.py',
        name: 'Tiny',
        startLine: 1,
        endLine: 8,
        loc: 8,
        methodCount: 1,
        attributeCount: 0,
      },
      { maxLoc: 15 }
    );
    expect(s?.kind).toBe('lazy-class');
  });
  it('ignores enum-like attribute-only classes', () => {
    const s = detectLazyClass(
      {
        filePath: 'a.py',
        name: 'Colors',
        startLine: 1,
        endLine: 5,
        loc: 5,
        methodCount: 0,
        attributeCount: 3,
      },
      { maxLoc: 15 }
    );
    expect(s).toBeNull();
  });
});

describe('primitive-obsession detector', () => {
  it('flags long, unannotated signatures', () => {
    const s = detectPrimitiveObsession(
      {
        filePath: 'a.py',
        name: 'f',
        startLine: 1,
        endLine: 2,
        paramCount: 6,
        annotatedParamCount: 0,
      },
      { params: 5 }
    );
    expect(s?.kind).toBe('primitive-obsession');
  });
  it('skips when any parameter is typed', () => {
    const s = detectPrimitiveObsession(
      {
        filePath: 'a.py',
        name: 'f',
        startLine: 1,
        endLine: 2,
        paramCount: 6,
        annotatedParamCount: 1,
      },
      { params: 5 }
    );
    expect(s).toBeNull();
  });
});

describe('god-function detector', () => {
  it('flags long AND complex top-level functions', () => {
    const s = detectGodFunction(
      {
        filePath: 'a.py',
        name: 'process_all',
        startLine: 1,
        endLine: 200,
        loc: 200,
        complexity: 30,
      },
      { loc: 80, complexity: 15 }
    );
    expect(s?.severity).toBe('critical');
  });
  it('does not flag a long but simple function', () => {
    const s = detectGodFunction(
      { filePath: 'a.py', name: 'big', startLine: 1, endLine: 200, loc: 200, complexity: 3 },
      { loc: 80, complexity: 15 }
    );
    expect(s).toBeNull();
  });
});

describe('commented-out code detector', () => {
  it('flags files with many commented assignments/imports', () => {
    const src = ['# import os', '# from x import y', '# foo = 1 + 2', '# baz = compute(x, y)'].join(
      '\n'
    );
    const s = detectCommentedOutCode({ filePath: 'a.py', source: src }, { lines: 3 });
    expect(s?.kind).toBe('commented-out-code');
  });
  it('ignores narrative comments', () => {
    const src = ['# this function does the thing', '# and it does it well'].join('\n');
    const s = detectCommentedOutCode({ filePath: 'a.py', source: src }, { lines: 3 });
    expect(s).toBeNull();
  });
});

describe('TODO accumulation detector', () => {
  it('flags a TODO-heavy file', () => {
    const src = Array(6).fill('# TODO: do the thing').join('\n');
    const s = detectTodoAccumulation({ filePath: 'a.py', source: src }, { count: 5 });
    expect(s?.kind).toBe('todo-accumulation');
  });
  it('does not flag a few TODOs', () => {
    const src = '# TODO: tidy this up later';
    const s = detectTodoAccumulation({ filePath: 'a.py', source: src }, { count: 5 });
    expect(s).toBeNull();
  });
});

describe('cyclic-dependencies detector', () => {
  it('emits one smell per cycle', () => {
    const anchors = new Map([
      ['mod_a', 'a/x.py'],
      ['mod_b', 'b/y.py'],
    ]);
    const names = new Map([
      ['mod_a', 'a'],
      ['mod_b', 'b'],
    ]);
    const out = detectCyclicDependencies({
      cycles: [
        {
          nodes: ['mod_a', 'mod_b'],
          edges: [
            { from: 'mod_a', to: 'mod_b' },
            { from: 'mod_b', to: 'mod_a' },
          ],
          representativePath: ['mod_a', 'mod_b', 'mod_a'],
        },
      ],
      moduleAnchors: anchors,
      moduleNames: names,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toMatch(/a → b → a/);
  });

  it('falls back gracefully when representativePath is missing (legacy IR)', () => {
    const out = detectCyclicDependencies({
      cycles: [{ nodes: ['mod_a', 'mod_b'] }],
      moduleAnchors: new Map([
        ['mod_a', 'a/x.py'],
        ['mod_b', 'b/y.py'],
      ]),
      moduleNames: new Map([
        ['mod_a', 'a'],
        ['mod_b', 'b'],
      ]),
    });
    expect(out).toHaveLength(1);
    // Backwards-compat fallback does NOT pretend the SCC is a linear chain.
    expect(out[0]!.message).not.toMatch(/→/);
    expect(out[0]!.message).toMatch(/a/);
    expect(out[0]!.message).toMatch(/b/);
  });
});

describe('unstable-dependency detector', () => {
  it('flags unstable modules that are also depended on', () => {
    const s = detectUnstableDependency(
      {
        moduleId: 'mod_x',
        moduleName: 'x',
        fanIn: 10,
        fanOut: 12,
        instability: 0.9,
        anchorFile: 'x/a.py',
      },
      { instability: 0.8, hubFanIn: 8 }
    );
    expect(s?.kind).toBe('unstable-dependency');
  });
  it('does not flag stable modules', () => {
    const s = detectUnstableDependency(
      {
        moduleId: 'mod_x',
        moduleName: 'x',
        fanIn: 10,
        fanOut: 1,
        instability: 0.1,
        anchorFile: 'x/a.py',
      },
      { instability: 0.8, hubFanIn: 8 }
    );
    expect(s).toBeNull();
  });
});

describe('god-package detector', () => {
  it('flags oversized modules', () => {
    const s = detectGodPackage(
      {
        moduleId: 'mod_x',
        moduleName: 'x',
        fileCount: 30,
        loc: 5000,
        anchorFile: 'x/a.py',
      },
      { files: 20, loc: 2000 }
    );
    expect(s?.severity).toBe('major');
  });
});

describe('scattered-functionality detector', () => {
  it('flags modules with high fan-out', () => {
    const s = detectScatteredFunctionality(
      { moduleId: 'mod_x', moduleName: 'x', fanOut: 15, anchorFile: 'x/a.py' },
      { fanOut: 8 }
    );
    expect(s?.kind).toBe('scattered-functionality');
  });
});

describe('cross-layer-skip detector', () => {
  it('flags presentation → persistence edges', () => {
    const out = detectCrossLayerSkip({
      edges: [{ from: 'mod_controllers', to: 'mod_repositories', kind: 'import', weight: 1 }],
      moduleNames: new Map([
        ['mod_controllers', 'controllers'],
        ['mod_repositories', 'repositories'],
      ]),
      moduleAnchors: new Map([
        ['mod_controllers', 'controllers/user.py'],
        ['mod_repositories', 'repositories/user_repo.py'],
      ]),
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('cross-layer-skip');
  });
  it('does not flag controller → service edges', () => {
    const out = detectCrossLayerSkip({
      edges: [{ from: 'mod_controllers', to: 'mod_services', kind: 'import', weight: 1 }],
      moduleNames: new Map([
        ['mod_controllers', 'controllers'],
        ['mod_services', 'services'],
      ]),
      moduleAnchors: new Map([
        ['mod_controllers', 'controllers/user.py'],
        ['mod_services', 'services/user_svc.py'],
      ]),
    });
    expect(out).toHaveLength(0);
  });
});
