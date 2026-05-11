import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FileIR, Repo, Smell } from '@archlens/ir-schema';
import type { PrismaService } from '../../src/database/prisma.service';

export interface SeededReport {
  scanId: string;
  reportId: string;
  irBlobPath: string;
  modules: { id: string; irModuleId: string; name: string }[];
  files: { id: string; path: string; irFileId: string; moduleId: string }[];
  ir: Repo;
}

export const FIXTURE_IR: Repo = {
  ir_version: '1.0.0',
  id: 'octocat/sample',
  name: 'sample',
  scannedAt: '2026-05-10T00:00:00.000Z',
  languages: ['typescript'],
  modules: [
    {
      id: 'mod-core',
      name: 'core',
      virtual: false,
      tags: [],
      files: [
        {
          id: 'file-core-index',
          path: 'src/core/index.ts',
          language: 'typescript',
          loc: 120,
          classes: [],
          functions: [
            {
              id: 'fn-core-main',
              name: 'main',
              signature: 'main(): void',
              complexity: 7,
              cognitive: 4,
              loc: 60,
              smells: [],
            },
            {
              id: 'fn-core-helper',
              name: 'helper',
              signature: 'helper(x: number): number',
              complexity: 3,
              cognitive: 2,
              loc: 20,
              smells: [],
            },
          ],
          smells: [
            {
              id: 'smell-core-1',
              kind: 'long-method',
              ruleId: 'long-method',
              severity: 'major',
              message: 'main is too long',
              file: 'src/core/index.ts',
              location: { startLine: 1, endLine: 60 },
            },
          ],
        },
        {
          id: 'file-core-util',
          path: 'src/core/util.ts',
          language: 'typescript',
          loc: 40,
          classes: [
            {
              id: 'cls-util',
              name: 'Util',
              fanIn: 2,
              fanOut: 1,
              methods: [
                {
                  id: 'm-util-do',
                  name: 'do',
                  signature: 'do(): void',
                  complexity: 2,
                  cognitive: 1,
                  loc: 10,
                  smells: [],
                },
              ],
              smells: [],
              tags: [],
            },
          ],
          functions: [],
          smells: [],
        },
      ],
    },
    {
      id: 'mod-web',
      name: 'web',
      virtual: false,
      tags: [],
      files: [
        {
          id: 'file-web-app',
          path: 'src/web/app.ts',
          language: 'typescript',
          loc: 80,
          classes: [],
          functions: [
            {
              id: 'fn-web-handler',
              name: 'handler',
              signature: 'handler(req, res): void',
              complexity: 5,
              cognitive: 3,
              loc: 40,
              smells: [
                {
                  id: 'smell-web-1',
                  kind: 'deep-nesting',
                  ruleId: 'deep-nesting',
                  severity: 'minor',
                  message: 'too many nested ifs',
                  file: 'src/web/app.ts',
                  location: { startLine: 10, endLine: 30 },
                },
              ],
            },
          ],
          smells: [
            {
              id: 'smell-web-critical',
              kind: 'god-class',
              ruleId: 'god-class',
              severity: 'critical',
              message: 'centralizes too much',
              file: 'src/web/app.ts',
            },
          ],
        },
      ],
    },
  ],
  edges: [{ from: 'mod-web', to: 'mod-core', kind: 'import', weight: 1 }],
  scoreBreakdown: {
    complexity: 78,
    duplication: 90,
    coupling: 82,
    cohesion: 85,
    smells: 70,
    overall: 81,
  },
  grade: 'B',
};

export async function seedReport(
  prisma: PrismaService,
  args: { scanId: string; repoId: string; ir?: Repo }
): Promise<SeededReport> {
  const ir = args.ir ?? FIXTURE_IR;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archlens-ir-'));
  const irBlobPath = path.join(tmpDir, `${args.scanId}.json`);
  await fs.writeFile(irBlobPath, JSON.stringify(ir), 'utf8');

  let totalFiles = 0;
  let totalClasses = 0;
  let totalFunctions = 0;
  const smellIds = new Set<string>();
  for (const m of ir.modules) {
    for (const f of m.files) {
      totalFiles += 1;
      totalClasses += f.classes.length;
      totalFunctions += f.functions.length;
      for (const c of f.classes) totalFunctions += c.methods.length;
      for (const s of f.smells) smellIds.add(s.id);
      for (const fn of f.functions) for (const s of fn.smells) smellIds.add(s.id);
      for (const c of f.classes) {
        for (const s of c.smells) smellIds.add(s.id);
        for (const me of c.methods) for (const s of me.smells) smellIds.add(s.id);
      }
    }
  }

  const report = await prisma.report.create({
    data: {
      scanId: args.scanId,
      repoId: args.repoId,
      irVersion: ir.ir_version,
      grade: ir.grade,
      overallScore: ir.scoreBreakdown.overall,
      complexityScore: ir.scoreBreakdown.complexity,
      duplicationScore: ir.scoreBreakdown.duplication,
      couplingScore: ir.scoreBreakdown.coupling,
      cohesionScore: ir.scoreBreakdown.cohesion,
      smellsScore: ir.scoreBreakdown.smells,
      modulesCount: ir.modules.length,
      filesCount: totalFiles,
      classesCount: totalClasses,
      functionsCount: totalFunctions,
      smellsCount: smellIds.size,
      irBlobPath,
    },
  });

  const moduleRows: SeededReport['modules'] = [];
  const fileRows: SeededReport['files'] = [];

  for (const irMod of ir.modules) {
    const m = await prisma.module.create({
      data: {
        reportId: report.id,
        irModuleId: irMod.id,
        name: irMod.name,
        virtual: irMod.virtual,
        filesCount: irMod.files.length,
      },
    });
    moduleRows.push({ id: m.id, irModuleId: m.irModuleId, name: m.name });

    for (const irFile of irMod.files) {
      const f = await prisma.file.create({
        data: {
          reportId: report.id,
          moduleId: m.id,
          irFileId: irFile.id,
          path: irFile.path,
          language: irFile.language,
          loc: irFile.loc,
        },
      });
      fileRows.push({
        id: f.id,
        path: f.path,
        irFileId: f.irFileId,
        moduleId: f.moduleId,
      });

      const fileSmellsAll = collectFileSmells(irFile);
      if (fileSmellsAll.length > 0) {
        await prisma.smell.createMany({
          data: fileSmellsAll.map((s) => ({
            reportId: report.id,
            fileId: f.id,
            irSmellId: s.id,
            kind: s.kind,
            ruleId: s.ruleId,
            severity: s.severity,
            message: s.message,
            filePath: s.file,
            startLine: s.location?.startLine ?? null,
            endLine: s.location?.endLine ?? null,
          })),
        });
      }
    }
  }

  return {
    scanId: args.scanId,
    reportId: report.id,
    irBlobPath,
    modules: moduleRows,
    files: fileRows,
    ir,
  };
}

function collectFileSmells(file: FileIR): Smell[] {
  const seen = new Map<string, Smell>();
  const add = (s: Smell): void => {
    if (!seen.has(s.id)) seen.set(s.id, s);
  };
  for (const s of file.smells) add(s);
  for (const fn of file.functions) for (const s of fn.smells) add(s);
  for (const c of file.classes) {
    for (const s of c.smells) add(s);
    for (const m of c.methods) for (const s of m.smells) add(s);
  }
  return Array.from(seen.values());
}

export async function cleanupSeededReport(seed: SeededReport): Promise<void> {
  await fs.rm(path.dirname(seed.irBlobPath), { recursive: true, force: true });
}
