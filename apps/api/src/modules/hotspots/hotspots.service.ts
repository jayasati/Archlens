import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FileIR } from '@archlens/ir-schema';
import type { HotspotDto } from '@archlens/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { IrLoader } from '../reports/ir-loader';

const STUB_CHURN_MIN = 1;
const STUB_CHURN_MAX = 100;

@Injectable()
export class HotspotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly irLoader: IrLoader
  ) {}

  async getHotspots(userId: string, scanId: string): Promise<HotspotDto[]> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { repository: { select: { userId: true } }, report: true },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.repository.userId !== userId) throw new ForbiddenException();
    if (!scan.report) throw new NotFoundException('Report not ready');

    const ir = await this.irLoader.load(scan.report.irBlobPath);
    const dbFiles = await this.prisma.file.findMany({
      where: { reportId: scan.report.id },
      select: { id: true, irFileId: true, path: true },
    });
    const byIrId = new Map(dbFiles.map((f) => [f.irFileId, f]));

    const hotspots: HotspotDto[] = [];
    for (const mod of ir.modules) {
      for (const file of mod.files) {
        const db = byIrId.get(file.id);
        const fileId = db?.id ?? file.id;
        const complexity = totalComplexity(file);
        const churn = stubChurn(file.path);
        const smellCount = countFileSmells(file);
        hotspots.push({
          fileId,
          path: file.path,
          complexity,
          churn,
          riskScore: complexity * churn,
          smellCount,
        });
      }
    }
    hotspots.sort((a, b) => b.riskScore - a.riskScore);
    return hotspots;
  }
}

function totalComplexity(file: FileIR): number {
  let total = 0;
  for (const fn of file.functions) total += fn.complexity;
  for (const c of file.classes) for (const m of c.methods) total += m.complexity;
  return total;
}

function countFileSmells(file: FileIR): number {
  const ids = new Set<string>();
  for (const s of file.smells) ids.add(s.id);
  for (const fn of file.functions) for (const s of fn.smells) ids.add(s.id);
  for (const c of file.classes) {
    for (const s of c.smells) ids.add(s.id);
    for (const m of c.methods) for (const s of m.smells) ids.add(s.id);
  }
  return ids.size;
}

// Deterministic, path-seeded pseudo-random churn so tests stay stable until
// real git-history churn is wired up (see ChurnSnapshot in pipeline plan).
function stubChurn(path: string): number {
  let h = 2166136261;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const range = STUB_CHURN_MAX - STUB_CHURN_MIN + 1;
  return STUB_CHURN_MIN + (Math.abs(h) % range);
}
