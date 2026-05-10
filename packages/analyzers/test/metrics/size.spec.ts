import { describe, expect, it } from 'vitest';
import { countLoc } from '../../src/metrics/size.js';

describe('countLoc', () => {
  it('counts non-empty non-comment lines', () => {
    const src = `# header\n\ndef foo():\n    return 1\n\n# trailing\n`;
    expect(countLoc(src)).toBe(2);
  });

  it('returns 0 for an empty string', () => {
    expect(countLoc('')).toBe(0);
  });

  it('handles CRLF line endings', () => {
    const src = `def foo():\r\n    return 1\r\n`;
    expect(countLoc(src)).toBe(2);
  });
});
