import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isValidIR, validateIR } from '@archlens/ir-schema';
import { PythonAdapter } from '../../src/adapters/python/python.adapter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '../fixtures/python-fastapi-sample');

describe('PythonAdapter integration', () => {
  it('produces a valid IR for the FastAPI fixture', async () => {
    const adapter = new PythonAdapter();
    const ir = await adapter.analyze(fixtureDir, { repoName: 'fastapi-sample' });

    expect(isValidIR(ir)).toBe(true);
    const validated = validateIR(ir);
    expect(validated.languages).toContain('python');
    expect(validated.name).toBe('fastapi-sample');
  });

  it('detects every expected module', async () => {
    const adapter = new PythonAdapter();
    const ir = await adapter.analyze(fixtureDir, {});
    const moduleNames = new Set(ir.modules.map((m) => m.name));

    expect(moduleNames.has('routers')).toBe(true);
    expect(moduleNames.has('services')).toBe(true);
    expect(moduleNames.has('models')).toBe(true);
    // top-level main.py becomes a module too
    expect(moduleNames.has('main')).toBe(true);
  });

  it('flags the intentional long-method and god-class smells', async () => {
    const adapter = new PythonAdapter();
    const ir = await adapter.analyze(fixtureDir, {});
    const allSmells = ir.modules.flatMap((m) =>
      m.files.flatMap((f) => [
        ...f.smells,
        ...f.functions.flatMap((fn) => fn.smells),
        ...f.classes.flatMap((c) => [...c.smells, ...c.methods.flatMap((mm) => mm.smells)]),
      ])
    );
    const kinds = new Set(allSmells.map((s) => s.kind));

    expect(kinds.has('long-method')).toBe(true);
    expect(kinds.has('god-class')).toBe(true);
    expect(kinds.has('deep-nesting')).toBe(true);

    const longMethods = allSmells.filter((s) => s.kind === 'long-method');
    expect(longMethods.some((s) => s.message.includes('complex_update'))).toBe(true);

    const godClasses = allSmells.filter((s) => s.kind === 'god-class');
    expect(godClasses.some((s) => s.message.includes('AuthService'))).toBe(true);
  });

  it('builds module-level edges from imports', async () => {
    const adapter = new PythonAdapter();
    const ir = await adapter.analyze(fixtureDir, {});
    expect(ir.edges.length).toBeGreaterThan(0);
    const pairs = new Set(ir.edges.map((e) => `${e.from}->${e.to}`));
    expect(pairs.has('mod_routers->mod_services')).toBe(true);
    expect(pairs.has('mod_routers->mod_models')).toBe(true);
  });

  it('returns scores in a sensible range', async () => {
    const adapter = new PythonAdapter();
    const ir = await adapter.analyze(fixtureDir, {});

    expect(ir.scoreBreakdown.overall).toBeGreaterThanOrEqual(0);
    expect(ir.scoreBreakdown.overall).toBeLessThanOrEqual(100);
    // The fixture has clear smells; overall should not be perfect.
    expect(ir.scoreBreakdown.overall).toBeLessThan(100);
    expect(['A', 'B', 'C', 'D', 'E']).toContain(ir.grade);
  });
});
