import { describe, expect, it } from 'vitest';
import { IR_VERSION, IRValidationError, isValidIR, validateIR, type Repo } from '../src/index.js';

const validIR: Repo = {
  ir_version: IR_VERSION,
  id: 'repo_1',
  name: 'demo',
  scannedAt: '2026-05-10T00:00:00.000Z',
  languages: ['typescript'],
  modules: [
    {
      id: 'mod_1',
      name: 'core',
      virtual: false,
      files: [
        {
          id: 'file_1',
          path: 'src/main.ts',
          language: 'typescript',
          loc: 42,
          classes: [],
          functions: [
            {
              id: 'fn_1',
              name: 'main',
              signature: 'main(): void',
              complexity: 3,
              cognitive: 2,
              loc: 10,
              smells: [],
            },
          ],
          smells: [],
        },
      ],
    },
  ],
  edges: [{ from: 'mod_1', to: 'mod_1', kind: 'reference', weight: 1 }],
  scoreBreakdown: {
    complexity: 80,
    duplication: 90,
    coupling: 70,
    cohesion: 75,
    smells: 85,
    overall: 80,
  },
  grade: 'B',
};

describe('IR schema', () => {
  it('accepts a valid IR', () => {
    const parsed = validateIR(validIR);
    expect(parsed.ir_version).toBe(IR_VERSION);
    expect(parsed.modules).toHaveLength(1);
    expect(isValidIR(validIR)).toBe(true);
  });

  it('throws IRValidationError when ir_version is missing', () => {
    const { ir_version: _omit, ...withoutVersion } = validIR;
    expect(() => validateIR(withoutVersion)).toThrow(IRValidationError);
    try {
      validateIR(withoutVersion);
    } catch (err) {
      expect(err).toBeInstanceOf(IRValidationError);
      const e = err as IRValidationError;
      expect(e.issues.some((i) => i.path === 'ir_version')).toBe(true);
      expect(e.message).toContain('ir_version');
    }
  });

  it('rejects an unsupported ir_version', () => {
    const bad = { ...validIR, ir_version: '2.0.0' as unknown as typeof IR_VERSION };
    expect(() => validateIR(bad)).toThrow(IRValidationError);
  });

  it('throws with a useful message on a malformed nested field', () => {
    const bad = {
      ...validIR,
      scoreBreakdown: { ...validIR.scoreBreakdown, overall: 150 },
    };
    try {
      validateIR(bad);
      throw new Error('expected validateIR to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(IRValidationError);
      const e = err as IRValidationError;
      const target = e.issues.find((i) => i.path === 'scoreBreakdown.overall');
      expect(target).toBeDefined();
      expect(target?.message.toLowerCase()).toContain('100');
    }
  });

  it('rejects an invalid grade', () => {
    const bad = { ...validIR, grade: 'F' as unknown as Repo['grade'] };
    expect(() => validateIR(bad)).toThrow(IRValidationError);
  });

  it('rejects empty languages array', () => {
    const bad = { ...validIR, languages: [] as Repo['languages'] };
    expect(() => validateIR(bad)).toThrow(IRValidationError);
  });

  it('isValidIR returns false on bad input', () => {
    expect(isValidIR({ foo: 'bar' })).toBe(false);
  });
});
