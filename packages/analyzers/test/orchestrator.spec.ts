import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isValidIR } from '@archlens/ir-schema';
import { analyzeRepo, detectLanguages } from '../src/orchestrator.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const nestFixture = path.resolve(here, 'fixtures/nest-sample');
const pyFixture = path.resolve(here, 'fixtures/python-fastapi-sample');

describe('analyzeRepo orchestrator', () => {
  it('detects typescript in the nest-sample fixture', async () => {
    const langs = await detectLanguages(nestFixture);
    expect(langs).toContain('typescript');
  });

  it('detects python in the fastapi fixture', async () => {
    const langs = await detectLanguages(pyFixture);
    expect(langs).toContain('python');
  });

  it('dispatches to NodeAdapter for nest-sample and produces a valid IR', async () => {
    const ir = await analyzeRepo(nestFixture, { repoName: 'nest-sample-orch' });
    expect(isValidIR(ir)).toBe(true);
    expect(ir.languages).toContain('typescript');
    expect(ir.modules.some((m) => m.id === 'mod_users')).toBe(true);
  });

  it('dispatches to PythonAdapter for the FastAPI fixture and produces a valid IR', async () => {
    const ir = await analyzeRepo(pyFixture, { repoName: 'fastapi-orch' });
    expect(isValidIR(ir)).toBe(true);
    expect(ir.languages).toContain('python');
  });

  it('throws when no supported source is detected', async () => {
    const empty = path.resolve(here, 'fixtures');
    // The fixtures dir itself contains supported files (recursively), so this
    // exercises the "no languages detected" path via a forced empty languages list.
    await expect(analyzeRepo(empty, { languages: [] as never })).rejects.toThrow(
      /No supported source files/
    );
  });
});
