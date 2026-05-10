import { describe, expect, it } from 'vitest';
import { detectGodClass } from '../../src/metrics/smells/god-class.js';
import { detectLongMethod } from '../../src/metrics/smells/long-method.js';
import { detectDeepNesting } from '../../src/metrics/smells/deep-nesting.js';

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
