export interface FileEdge {
  fromFile: string;
  toFile: string;
}

export interface ModuleSize {
  loc: number;
  fileCount: number;
}

export interface CohesionResult {
  /** moduleId → cohesion ratio (0..1). Modules with no signal are absent. */
  ratios: Map<string, number>;
  /** Σ (cohesionRatio_M × loc_M) over modules that contributed signal. */
  cohesionWeighted: number;
  /** Σ loc_M over the same set of modules. */
  moduleLocSum: number;
}

/**
 * Per-module cohesion: how many imports stay inside the module vs leak out.
 *
 *   cohesionRatio_M = internalEdges_M / (internalEdges_M + externalEdges_M)
 *
 * 1.0 = perfectly self-contained, 0.0 = every import leaves. Skips modules
 * that have only one file (no possible internal edges) and modules that
 * import nothing (no signal either way). Repo-wide cohesion is the LOC-
 * weighted average over the remaining set, so a tiny toy module can't
 * dominate the score.
 *
 * Edges are counted as 1 each regardless of `weight` on the underlying
 * Edge — we want connectivity, not call frequency.
 */
export function computeModuleCohesion(
  fileEdges: FileEdge[],
  fileToModule: Map<string, string>,
  moduleSizes: Map<string, ModuleSize>
): CohesionResult {
  const internal = new Map<string, number>();
  const external = new Map<string, number>();

  for (const edge of fileEdges) {
    const fromModule = fileToModule.get(edge.fromFile);
    if (fromModule == null) continue;
    const toModule = fileToModule.get(edge.toFile);
    if (toModule != null && toModule === fromModule) {
      internal.set(fromModule, (internal.get(fromModule) ?? 0) + 1);
    } else {
      external.set(fromModule, (external.get(fromModule) ?? 0) + 1);
    }
  }

  const ratios = new Map<string, number>();
  let cohesionWeighted = 0;
  let moduleLocSum = 0;

  for (const [moduleId, size] of moduleSizes) {
    if (size.fileCount <= 1) continue;
    const i = internal.get(moduleId) ?? 0;
    const e = external.get(moduleId) ?? 0;
    const total = i + e;
    if (total === 0) continue;
    const ratio = i / total;
    ratios.set(moduleId, ratio);
    cohesionWeighted += ratio * size.loc;
    moduleLocSum += size.loc;
  }

  return { ratios, cohesionWeighted, moduleLocSum };
}
