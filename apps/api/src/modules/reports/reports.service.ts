import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Report, Smell as SmellRow } from '@prisma/client';
import type {
  FileIR,
  Grade,
  IrVersion,
  Module as IrModule,
  Smell as IrSmell,
} from '@archlens/ir-schema';
import type {
  ReportFileDetailDto,
  ReportFileSourceDto,
  ReportModuleDetailDto,
  ReportModuleFileDto,
  ReportModuleScoreDto,
  ReportSummaryDto,
} from '@archlens/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { IrLoader } from './ir-loader';
import { SourceLoader } from './source-loader';

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  info: 3,
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly irLoader: IrLoader,
    private readonly sourceLoader: SourceLoader
  ) {}

  async getSummary(userId: string, scanId: string): Promise<ReportSummaryDto> {
    const report = await this.loadOwnedReport(userId, scanId);
    const ir = await this.irLoader.load(report.irBlobPath);
    const smellRows = await this.prisma.smell.findMany({
      where: { reportId: report.id },
    });
    // 20 keeps the payload small but gives the web UI's per-metric exact-
    // mitigation panels enough offenders to render — when filtered to one
    // metric's relatedSmells, 5 usually meant 0–2 hits per panel.
    const topSmells = pickTopSmells(smellRows, 20);
    // Resolve cycle node IDs to display names from the IR module list. New IR
    // emits edges + a representative path; older IR may only have `nodes`.
    const moduleNameById = new Map(ir.modules.map((m) => [m.id, m.name]));
    const nameOf = (id: string): string => moduleNameById.get(id) ?? id;
    const cycles = ir.cycles?.map((c) => ({
      moduleIds: c.nodes,
      moduleNames: c.nodes.map(nameOf),
      edges: c.edges?.map((e) => ({
        fromId: e.from,
        toId: e.to,
        fromName: nameOf(e.from),
        toName: nameOf(e.to),
      })),
      representativePathIds: c.representativePath,
      representativePathNames: c.representativePath?.map(nameOf),
    }));
    return {
      id: report.id,
      scanId: report.scanId,
      repoId: report.repoId,
      ir_version: report.irVersion as IrVersion,
      grade: report.grade as Grade,
      scoreBreakdown: ir.scoreBreakdown,
      counts: {
        modules: report.modulesCount,
        files: report.filesCount,
        classes: report.classesCount,
        functions: report.functionsCount,
        smells: report.smellsCount,
      },
      topSmells,
      cycles,
      generatedAt: report.generatedAt.toISOString(),
    };
  }

  async listModules(userId: string, scanId: string): Promise<ReportModuleScoreDto[]> {
    const report = await this.loadOwnedReport(userId, scanId);
    const ir = await this.irLoader.load(report.irBlobPath);
    const dbModules = await this.prisma.module.findMany({
      where: { reportId: report.id },
    });
    const byIrId = new Map(dbModules.map((m) => [m.irModuleId, m]));
    return ir.modules.map((irMod) => {
      const db = byIrId.get(irMod.id);
      const stats = aggregateModule(irMod);
      return {
        id: db?.id ?? '',
        irModuleId: irMod.id,
        name: irMod.name,
        virtual: irMod.virtual,
        fileCount: stats.fileCount,
        classCount: stats.classCount,
        functionCount: stats.functionCount,
        smellCount: stats.smellCount,
        totalLoc: stats.totalLoc,
        totalComplexity: stats.totalComplexity,
        avgComplexity: stats.avgComplexity,
        maxComplexity: stats.maxComplexity,
        cohesionRatio: irMod.cohesionRatio,
        fanIn: irMod.fanIn,
        fanOut: irMod.fanOut,
        instability: irMod.instability,
        abstractness: irMod.abstractness,
        martinDistance: irMod.martinDistance,
        scoreBreakdown: irMod.scoreBreakdown,
      };
    });
  }

  async getModule(
    userId: string,
    scanId: string,
    moduleId: string
  ): Promise<ReportModuleDetailDto> {
    const report = await this.loadOwnedReport(userId, scanId);
    const dbMod = await this.prisma.module.findFirst({
      where: { id: moduleId, reportId: report.id },
    });
    if (!dbMod) throw new NotFoundException('Module not found');

    const ir = await this.irLoader.load(report.irBlobPath);
    const irMod = ir.modules.find((m) => m.id === dbMod.irModuleId);
    if (!irMod) throw new NotFoundException('Module missing from IR');

    const dbFiles = await this.prisma.file.findMany({
      where: { moduleId: dbMod.id },
    });
    const dbFilesByIrId = new Map(dbFiles.map((f) => [f.irFileId, f]));

    const stats = aggregateModule(irMod);
    const moduleSmells: IrSmell[] = [];
    const files: ReportModuleFileDto[] = irMod.files.map((f) => {
      const dbF = dbFilesByIrId.get(f.id);
      const fileSmells = collectFileSmells(f);
      moduleSmells.push(...fileSmells);
      return {
        id: dbF?.id ?? '',
        irFileId: f.id,
        path: f.path,
        language: f.language,
        loc: f.loc,
        complexity: fileTotalComplexity(f),
        smellCount: fileSmells.length,
      };
    });

    return {
      id: dbMod.id,
      irModuleId: dbMod.irModuleId,
      name: dbMod.name,
      virtual: dbMod.virtual,
      fileCount: stats.fileCount,
      classCount: stats.classCount,
      functionCount: stats.functionCount,
      smellCount: stats.smellCount,
      totalLoc: stats.totalLoc,
      totalComplexity: stats.totalComplexity,
      avgComplexity: stats.avgComplexity,
      maxComplexity: stats.maxComplexity,
      cohesionRatio: irMod.cohesionRatio,
      fanIn: irMod.fanIn,
      fanOut: irMod.fanOut,
      instability: irMod.instability,
      abstractness: irMod.abstractness,
      martinDistance: irMod.martinDistance,
      scoreBreakdown: irMod.scoreBreakdown,
      files,
      smells: moduleSmells.sort(
        (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
      ),
    };
  }

  async getFile(userId: string, scanId: string, filePath: string): Promise<ReportFileDetailDto> {
    const report = await this.loadOwnedReport(userId, scanId);
    const dbFile = await this.prisma.file.findFirst({
      where: { reportId: report.id, path: filePath },
      include: { module: { select: { id: true, name: true } } },
    });
    if (!dbFile) throw new NotFoundException('File not found');

    const ir = await this.irLoader.load(report.irBlobPath);
    let irFile: FileIR | undefined;
    for (const m of ir.modules) {
      const f = m.files.find((x) => x.id === dbFile.irFileId || x.path === filePath);
      if (f) {
        irFile = f;
        break;
      }
    }
    if (!irFile) throw new NotFoundException('File missing from IR');

    const total = fileTotalComplexity(irFile);
    const units =
      irFile.functions.length + irFile.classes.reduce((n, c) => n + c.methods.length, 0);

    return {
      id: dbFile.id,
      reportId: report.id,
      irFileId: irFile.id,
      moduleId: dbFile.module.id,
      moduleName: dbFile.module.name,
      path: irFile.path,
      language: irFile.language,
      loc: irFile.loc,
      totalComplexity: total,
      avgComplexity: units > 0 ? round2(total / units) : 0,
      classes: irFile.classes,
      functions: irFile.functions,
      smells: collectFileSmells(irFile),
    };
  }

  async getFileSource(
    userId: string,
    scanId: string,
    fileId: string
  ): Promise<ReportFileSourceDto> {
    const report = await this.loadOwnedReport(userId, scanId);
    const dbFile = await this.prisma.file.findFirst({
      where: { id: fileId, reportId: report.id },
    });
    if (!dbFile) throw new NotFoundException('File not found');

    const content = await this.sourceLoader.loadFile(report.sourceDirPath, dbFile.irFileId);
    if (content === null) {
      throw new NotFoundException(
        'Source not stored for this file. It may predate source snapshotting or have been skipped during scan.'
      );
    }

    const ir = await this.irLoader.load(report.irBlobPath);
    let irFile: FileIR | undefined;
    for (const m of ir.modules) {
      const f = m.files.find((x) => x.id === dbFile.irFileId);
      if (f) {
        irFile = f;
        break;
      }
    }
    const smells = irFile ? collectFileSmells(irFile) : [];

    return {
      id: dbFile.id,
      irFileId: dbFile.irFileId,
      path: dbFile.path,
      language: dbFile.language as ReportFileSourceDto['language'],
      content,
      truncated: dbFile.truncated,
      byteSize: dbFile.byteSize ?? undefined,
      smells: smells.sort(
        (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
      ),
    };
  }

  private async loadOwnedReport(userId: string, scanId: string): Promise<Report> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { repository: { select: { userId: true } }, report: true },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.repository.userId !== userId) throw new ForbiddenException();
    if (!scan.report) throw new NotFoundException('Report not ready');
    return scan.report;
  }
}

interface ModuleAggregate {
  fileCount: number;
  classCount: number;
  functionCount: number;
  smellCount: number;
  totalLoc: number;
  totalComplexity: number;
  avgComplexity: number;
  maxComplexity: number;
}

function aggregateModule(mod: IrModule): ModuleAggregate {
  let classCount = 0;
  let functionCount = 0;
  let totalLoc = 0;
  let totalComplexity = 0;
  let maxComplexity = 0;
  let units = 0;
  const smellIds = new Set<string>();

  for (const f of mod.files) {
    totalLoc += f.loc;
    classCount += f.classes.length;
    functionCount += f.functions.length;
    for (const fn of f.functions) {
      totalComplexity += fn.complexity;
      if (fn.complexity > maxComplexity) maxComplexity = fn.complexity;
      units += 1;
      for (const s of fn.smells) smellIds.add(s.id);
    }
    for (const c of f.classes) {
      functionCount += c.methods.length;
      for (const m of c.methods) {
        totalComplexity += m.complexity;
        if (m.complexity > maxComplexity) maxComplexity = m.complexity;
        units += 1;
        for (const s of m.smells) smellIds.add(s.id);
      }
      for (const s of c.smells) smellIds.add(s.id);
    }
    for (const s of f.smells) smellIds.add(s.id);
  }

  return {
    fileCount: mod.files.length,
    classCount,
    functionCount,
    smellCount: smellIds.size,
    totalLoc,
    totalComplexity,
    avgComplexity: units > 0 ? round2(totalComplexity / units) : 0,
    maxComplexity,
  };
}

function fileTotalComplexity(file: FileIR): number {
  let total = 0;
  for (const fn of file.functions) total += fn.complexity;
  for (const c of file.classes) for (const m of c.methods) total += m.complexity;
  return total;
}

function collectFileSmells(file: FileIR): IrSmell[] {
  const seen = new Map<string, IrSmell>();
  const add = (s: IrSmell): void => {
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

function pickTopSmells(rows: SmellRow[], n: number): IrSmell[] {
  const sorted = [...rows].sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 99;
    const rb = SEVERITY_RANK[b.severity] ?? 99;
    return ra - rb;
  });
  return sorted.slice(0, n).map(rowToIrSmell);
}

function rowToIrSmell(row: SmellRow): IrSmell {
  const smell: IrSmell = {
    id: row.irSmellId,
    kind: row.kind,
    ruleId: row.ruleId,
    severity: row.severity as IrSmell['severity'],
    message: row.message,
    file: row.filePath,
  };
  if (row.startLine != null && row.endLine != null) {
    smell.location = { startLine: row.startLine, endLine: row.endLine };
  }
  return smell;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
