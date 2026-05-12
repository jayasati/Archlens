import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isValidIR, IR_VERSION, type Repo } from '@archlens/ir-schema';
import {
  analyzeRepo,
  detectLanguages,
  mergeIRs,
  disambiguateModuleIds,
} from '../src/orchestrator.js';
import {
  detectNodeWorkspaces,
  workspaceForFile,
  parsePnpmWorkspaceYaml,
} from '../src/adapters/node/workspace-detector.js';
import { resolveModule } from '../src/adapters/node/node.adapter.js';

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

describe('mergeIRs cross-adapter module-ID disambiguation', () => {
  function makeIR(language: 'python' | 'typescript', moduleId: string, otherId: string): Repo {
    return {
      ir_version: IR_VERSION,
      id: `repo_${language}`,
      name: `repo_${language}`,
      scannedAt: '2026-05-11T00:00:00.000Z',
      languages: [language],
      modules: [
        { id: moduleId, name: moduleId.replace(/^mod_/, ''), virtual: false, files: [], tags: [] },
        { id: otherId, name: otherId.replace(/^mod_/, ''), virtual: false, files: [], tags: [] },
      ],
      edges: [{ from: moduleId, to: otherId, kind: 'import', weight: 1 }],
      scoreBreakdown: {
        complexity: 100,
        duplication: 100,
        coupling: 100,
        cohesion: 100,
        smells: 100,
        overall: 100,
      },
      grade: 'A',
    };
  }

  it('renames colliding module IDs and rewrites edges', () => {
    const pyIR = makeIR('python', 'mod_packages', 'mod_models');
    const nodeIR = makeIR('typescript', 'mod_packages', 'mod_components');
    const [pyRenamed, nodeRenamed] = disambiguateModuleIds([pyIR, nodeIR]);

    // Both colliding `mod_packages` entries renamed by language
    expect(pyRenamed?.modules.map((m) => m.id)).toContain('mod_packages__python');
    expect(nodeRenamed?.modules.map((m) => m.id)).toContain('mod_packages__typescript');
    expect(pyRenamed?.modules.some((m) => m.id === 'mod_packages')).toBe(false);
    expect(nodeRenamed?.modules.some((m) => m.id === 'mod_packages')).toBe(false);

    // Non-colliding modules pass through unchanged
    expect(pyRenamed?.modules.some((m) => m.id === 'mod_models')).toBe(true);
    expect(nodeRenamed?.modules.some((m) => m.id === 'mod_components')).toBe(true);

    // Edges referencing the renamed module are rewritten on the `from` side
    expect(pyRenamed?.edges[0]?.from).toBe('mod_packages__python');
    expect(nodeRenamed?.edges[0]?.from).toBe('mod_packages__typescript');

    // Display name carries the language tag so the UI can tell the rows apart
    const pyPackages = pyRenamed?.modules.find((m) => m.id === 'mod_packages__python');
    expect(pyPackages?.name).toBe('packages (python)');
  });

  it('leaves IDs alone when there are no collisions', () => {
    const pyIR = makeIR('python', 'mod_routers', 'mod_models');
    const nodeIR = makeIR('typescript', 'mod_users', 'mod_components');
    const out = disambiguateModuleIds([pyIR, nodeIR]);
    expect(out[0]?.modules.map((m) => m.id)).toEqual(['mod_routers', 'mod_models']);
    expect(out[1]?.modules.map((m) => m.id)).toEqual(['mod_users', 'mod_components']);
  });

  it('mergeIRs end-to-end shows both renamed rows in the merged repo', () => {
    const pyIR = makeIR('python', 'mod_packages', 'mod_models');
    const nodeIR = makeIR('typescript', 'mod_packages', 'mod_components');
    const merged = mergeIRs([pyIR, nodeIR], '/tmp/test-repo', { repoName: 'polyglot' });
    const ids = merged.modules.map((m) => m.id);
    expect(ids).toContain('mod_packages__python');
    expect(ids).toContain('mod_packages__typescript');
    // No duplicate `mod_packages` survives.
    expect(ids.filter((id) => id === 'mod_packages').length).toBe(0);
    expect(merged.languages.sort()).toEqual(['python', 'typescript']);
  });
});

describe('Node workspace detection and module grouping', () => {
  const archlensRoot = path.resolve(here, '..', '..', '..');

  it('parses a typical pnpm-workspace.yaml', () => {
    const yaml = [
      'packages:',
      "  - 'apps/*'",
      "  - 'packages/*'",
      '  # ignored comment',
      "  - 'tools/parser-jars/*'",
      '',
    ].join('\n');
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(['apps/*', 'packages/*', 'tools/parser-jars/*']);
  });

  it('parses an inline-array packages declaration', () => {
    const yaml = 'packages: [\'apps/*\', "packages/*"]\n';
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(['apps/*', 'packages/*']);
  });

  it('discovers archlens workspaces from pnpm-workspace.yaml', async () => {
    const workspaces = await detectNodeWorkspaces(archlensRoot);
    const ids = new Set(workspaces.map((w) => w.moduleId));
    expect(ids.has('mod_api')).toBe(true);
    expect(ids.has('mod_web')).toBe(true);
    expect(ids.has('mod_worker')).toBe(true);
    expect(ids.has('mod_analyzers')).toBe(true);
    expect(ids.has('mod_shared_types')).toBe(true);
    expect(ids.has('mod_ir_schema')).toBe(true);
  });

  it('routes files to the right workspace via resolveModule', async () => {
    const workspaces = await detectNodeWorkspaces(archlensRoot);
    expect(resolveModule('apps/api/src/main.ts', workspaces).moduleId).toBe('mod_api');
    expect(resolveModule('apps/web/src/app/page.tsx', workspaces).moduleId).toBe('mod_web');
    expect(resolveModule('apps/worker/src/main.ts', workspaces).moduleId).toBe('mod_worker');
    expect(resolveModule('packages/analyzers/src/index.ts', workspaces).moduleId).toBe(
      'mod_analyzers'
    );
    expect(resolveModule('packages/shared-types/src/index.ts', workspaces).moduleId).toBe(
      'mod_shared_types'
    );
  });

  it('falls back to the single-package heuristic outside any workspace', () => {
    const result = resolveModule('apps/api/src/main.ts', []);
    expect(result.moduleId).toBe('mod_apps');
  });

  it('workspaceForFile returns null when the file is outside every workspace', async () => {
    const workspaces = await detectNodeWorkspaces(archlensRoot);
    expect(workspaceForFile('eslint.config.mjs', workspaces)).toBeNull();
    expect(workspaceForFile('README.md', workspaces)).toBeNull();
  });
});
