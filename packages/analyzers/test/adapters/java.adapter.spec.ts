import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isValidIR, type ClassIR, type Module } from '@archlens/ir-schema';
import { JavaAdapter } from '../../src/adapters/java/java.adapter.js';
import { probeJava } from '../../src/adapters/java/runners/javaparser.runner.js';
import { buildBeanGraph, classKey } from '../../src/adapters/java/spring/bean-graph.js';
import { classifySpringClass } from '../../src/adapters/java/spring/layer-detector.js';
import { applySpringRules } from '../../src/adapters/java/spring/spring-rules.js';
import { runJavaParserRunner } from '../../src/adapters/java/runners/javaparser.runner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '../fixtures/spring-petclinic-mini');

function findClass(modules: Module[], name: string): ClassIR | undefined {
  for (const mod of modules) {
    for (const file of mod.files) {
      const cls = file.classes.find((c) => c.name === name);
      if (cls) return cls;
    }
  }
  return undefined;
}

// Decide Java availability at test-collection time so it.skipIf() sees the
// correct value (vitest evaluates skipIf when the test is declared, not when
// it's run). Top-level await is supported in vitest's ESM transform.
const javaAvailable = await probeJava()
  .then(() => true)
  .catch(() => false);

const cachedJavaParserOutput: Awaited<ReturnType<typeof runJavaParserRunner>> | null = javaAvailable
  ? await runJavaParserRunner(fixtureDir).catch(() => null)
  : null;

describe('JavaAdapter integration (spring-petclinic-mini fixture)', () => {
  it.skipIf(!javaAvailable)('produces a valid IR via java -jar', async () => {
    const ir = await new JavaAdapter().analyze(fixtureDir, { repoName: 'petclinic-mini' });
    expect(isValidIR(ir)).toBe(true);
    expect(ir.languages).toContain('java');
    expect(ir.name).toBe('petclinic-mini');
  });

  it.skipIf(!javaAvailable)('discovers the pets and vets modules', async () => {
    const ir = await new JavaAdapter().analyze(fixtureDir, {});
    const ids = new Set(ir.modules.map((m) => m.id));
    expect(ids.has('mod_pets')).toBe(true);
    expect(ids.has('mod_vets')).toBe(true);
  });

  it.skipIf(!javaAvailable)('tags @RestController classes with layer:controller', async () => {
    const ir = await new JavaAdapter().analyze(fixtureDir, {});
    const petCtrl = findClass(ir.modules, 'PetController');
    const vetCtrl = findClass(ir.modules, 'VetController');
    expect(petCtrl?.tags).toContain('layer:controller');
    expect(petCtrl?.tags).toContain('spring:RestController');
    expect(vetCtrl?.tags).toContain('layer:controller');
  });

  it.skipIf(!javaAvailable)('tags @Service classes with layer:service', async () => {
    const ir = await new JavaAdapter().analyze(fixtureDir, {});
    const petSvc = findClass(ir.modules, 'PetService');
    expect(petSvc?.tags).toContain('layer:service');
    expect(petSvc?.tags).toContain('spring:Service');
  });

  it.skipIf(!javaAvailable)('tags @Repository classes with layer:repository', async () => {
    const ir = await new JavaAdapter().analyze(fixtureDir, {});
    const petRepo = findClass(ir.modules, 'PetRepository');
    const vetRepo = findClass(ir.modules, 'VetRepository');
    expect(petRepo?.tags).toContain('layer:repository');
    expect(vetRepo?.tags).toContain('layer:repository');
  });

  it.skipIf(!javaAvailable)('bean graph includes all @Autowired edges', () => {
    expect(cachedJavaParserOutput).not.toBeNull();
    const out = cachedJavaParserOutput!;
    const classInfo = new Map();
    for (const file of out.files) {
      for (const cls of file.classes) {
        classInfo.set(classKey(file, cls), classifySpringClass(cls));
      }
    }
    const graph = buildBeanGraph(out.files, classInfo);

    const petCtrl = 'com.example.petclinic.pets.PetController';
    const petSvc = 'com.example.petclinic.pets.PetService';
    const petRepo = 'com.example.petclinic.pets.PetRepository';
    const vetCtrl = 'com.example.petclinic.vets.VetController';
    const vetRepo = 'com.example.petclinic.vets.VetRepository';

    const hasEdge = (from: string, to: string): boolean =>
      graph.edges.some((e) => e.fromId === from && e.toId === to);

    expect(hasEdge(petCtrl, petSvc)).toBe(true); // constructor injection
    expect(hasEdge(petSvc, petRepo)).toBe(true); // constructor injection
    expect(hasEdge(vetCtrl, vetRepo)).toBe(true); // constructor injection
    expect(hasEdge(vetCtrl, petRepo)).toBe(true); // @Autowired field — the violation
  });

  it.skipIf(!javaAvailable)('detects the planted layer-skip violation', () => {
    expect(cachedJavaParserOutput).not.toBeNull();
    const out = cachedJavaParserOutput!;
    const classInfo = new Map();
    for (const file of out.files) {
      for (const cls of file.classes) {
        classInfo.set(classKey(file, cls), classifySpringClass(cls));
      }
    }
    const graph = buildBeanGraph(out.files, classInfo);
    const rules = applySpringRules(graph);

    const layerSkips = rules.smells.filter((s) => s.kind === 'spring-layer-skip');
    expect(layerSkips.length).toBeGreaterThanOrEqual(1);
    const vetCtrlSkip = layerSkips.find(
      (s) => s.beanId === 'com.example.petclinic.vets.VetController'
    );
    expect(vetCtrlSkip).toBeDefined();
    expect(vetCtrlSkip!.targetBeanId).toBe('com.example.petclinic.pets.PetRepository');
    expect(vetCtrlSkip!.message).toContain('VetController');
    expect(vetCtrlSkip!.message).toContain('PetRepository');
  });

  it.skipIf(!javaAvailable)('surfaces the layer-skip smell on the IR class', async () => {
    const ir = await new JavaAdapter().analyze(fixtureDir, {});
    const vetCtrl = findClass(ir.modules, 'VetController');
    expect(vetCtrl).toBeDefined();
    const smellKinds = vetCtrl!.smells.map((s) => s.kind);
    expect(smellKinds).toContain('spring-layer-skip');
  });

  it('reports java availability cleanly when missing', async () => {
    // Smoke-test the probe path itself — even on machines without java, it should
    // throw a typed error rather than hang.
    try {
      await probeJava('definitely-not-a-real-java-binary');
      throw new Error('probeJava should have rejected');
    } catch (err) {
      expect((err as Error).name).toBe('JavaNotAvailableError');
    }
  });
});
