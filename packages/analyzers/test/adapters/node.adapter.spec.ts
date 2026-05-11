import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isValidIR, validateIR, type ClassIR, type Module } from '@archlens/ir-schema';
import { NodeAdapter } from '../../src/adapters/node/node.adapter.js';
import { buildModuleGraph } from '../../src/graph/graph-builder.js';
import { detectCycles } from '../../src/graph/cycle-detector.js';
import { buildMermaidLayerDiagram } from '../../src/diagrams/layer-diagram.builder.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '../fixtures/nest-sample');

function findClass(modules: Module[], name: string): ClassIR | undefined {
  for (const mod of modules) {
    for (const file of mod.files) {
      const cls = file.classes.find((c) => c.name === name);
      if (cls) return cls;
    }
  }
  return undefined;
}

describe('NodeAdapter integration (nest-sample fixture)', () => {
  it('produces a valid IR', async () => {
    const adapter = new NodeAdapter();
    const ir = await adapter.analyze(fixtureDir, { repoName: 'nest-sample' });

    expect(isValidIR(ir)).toBe(true);
    const validated = validateIR(ir);
    expect(validated.languages).toContain('typescript');
    expect(validated.name).toBe('nest-sample');
  });

  it('discovers the users and orders modules', async () => {
    const ir = await new NodeAdapter().analyze(fixtureDir, {});
    const ids = new Set(ir.modules.map((m) => m.id));
    expect(ids.has('mod_users')).toBe(true);
    expect(ids.has('mod_orders')).toBe(true);
  });

  it('detects the intentional users <-> orders cycle', async () => {
    const ir = await new NodeAdapter().analyze(fixtureDir, {});
    const graph = buildModuleGraph(
      ir.modules.map((m) => m.id),
      ir.edges
    );
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const involvesBoth = cycles.some(
      (c) => c.nodes.includes('mod_users') && c.nodes.includes('mod_orders')
    );
    expect(involvesBoth).toBe(true);
  });

  it('tags @Controller classes with layer:controller', async () => {
    const ir = await new NodeAdapter().analyze(fixtureDir, {});
    const usersCtrl = findClass(ir.modules, 'UsersController');
    const ordersCtrl = findClass(ir.modules, 'OrdersController');
    expect(usersCtrl?.tags).toContain('layer:controller');
    expect(usersCtrl?.tags).toContain('nest:controller');
    expect(ordersCtrl?.tags).toContain('layer:controller');
  });

  it('tags @Injectable services with layer:service', async () => {
    const ir = await new NodeAdapter().analyze(fixtureDir, {});
    const usersSvc = findClass(ir.modules, 'UsersService');
    const ordersSvc = findClass(ir.modules, 'OrdersService');
    expect(usersSvc?.tags).toContain('layer:service');
    expect(usersSvc?.tags).toContain('nest:injectable');
    expect(ordersSvc?.tags).toContain('layer:service');
  });

  it('tags @Module classes and stamps the module with nest-module', async () => {
    const ir = await new NodeAdapter().analyze(fixtureDir, {});
    const usersModuleClass = findClass(ir.modules, 'UsersModule');
    expect(usersModuleClass?.tags).toContain('layer:module');

    const usersIR = ir.modules.find((m) => m.id === 'mod_users');
    expect(usersIR?.tags).toContain('nest-module');
    expect(usersIR?.tags).toContain('contains:controller');
    expect(usersIR?.tags).toContain('contains:service');
  });

  it('resolves @app/* path aliases from tsconfig', async () => {
    // users.service.ts imports `@app/orders/orders.service` — that import is the ONLY
    // source of a mod_users -> mod_orders edge (the relative imports in users.module.ts
    // and users.controller.ts are intra-module). So this edge proves alias resolution.
    const ir = await new NodeAdapter().analyze(fixtureDir, {});
    const aliasEdge = ir.edges.find((e) => e.from === 'mod_users' && e.to === 'mod_orders');
    expect(aliasEdge).toBeDefined();
  });

  it('produces a sensible Mermaid layer diagram', async () => {
    const ir = await new NodeAdapter().analyze(fixtureDir, {});
    const mermaid = buildMermaidLayerDiagram(ir.modules, ir.edges);

    expect(mermaid.startsWith('graph TD')).toBe(true);
    expect(mermaid).toContain('classDef controller');
    expect(mermaid).toContain('classDef service');
    expect(mermaid).toContain(':::controller');
    expect(mermaid).toContain(':::service');
    expect(mermaid).toContain('subgraph mod_users');
    expect(mermaid).toContain('subgraph mod_orders');
  });
});
