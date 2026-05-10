import { describe, expect, it } from 'vitest';
import { parsePythonSource } from '../../src/adapters/python/ast-walker.js';
import { computeComplexity } from '../../src/metrics/complexity.js';

async function complexityOf(
  source: string
): Promise<{ cyclomatic: number; cognitive: number; depth: number }> {
  const parsed = await parsePythonSource('snippet.py', source);
  const fn = parsed.functions[0];
  if (!fn) throw new Error('no function parsed');
  const result = computeComplexity(fn.bodyNode);
  return {
    cyclomatic: result.cyclomatic,
    cognitive: result.cognitive,
    depth: result.maxNestingDepth,
  };
}

describe('cyclomatic complexity', () => {
  it('returns 1 for a straight-line function', async () => {
    const { cyclomatic } = await complexityOf(`def foo():\n    return 1\n`);
    expect(cyclomatic).toBe(1);
  });

  it('counts an if branch', async () => {
    const { cyclomatic } = await complexityOf(
      `def foo(x):\n    if x:\n        return 1\n    return 0\n`
    );
    expect(cyclomatic).toBe(2);
  });

  it('counts elif branches', async () => {
    const src = `def foo(x):\n    if x == 1:\n        return 'a'\n    elif x == 2:\n        return 'b'\n    else:\n        return 'c'\n`;
    const { cyclomatic } = await complexityOf(src);
    expect(cyclomatic).toBe(3);
  });

  it('counts boolean operators', async () => {
    const { cyclomatic } = await complexityOf(
      `def foo(a, b, c):\n    if a and b or c:\n        return 1\n    return 0\n`
    );
    expect(cyclomatic).toBe(4);
  });

  it('tracks max nesting depth', async () => {
    const src = `def foo(x):\n    if x:\n        for i in range(x):\n            while i > 0:\n                i -= 1\n`;
    const { depth } = await complexityOf(src);
    expect(depth).toBe(3);
  });
});
