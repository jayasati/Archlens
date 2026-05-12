export interface FileEdge {
  fromFile: string;
  toFile: string;
}

export interface ModuleSize {
  loc: number;
  fileCount: number;
}

export interface CohesionResult {
  /** moduleId → inner cohesion (file ↔ file inside the same module). */
  ratios: Map<string, number>;
  /**
   * moduleId → workspace-grouped cohesion. Edges to sibling submodules of
   * the same workspace count as internal. When `fileToGroup` is omitted or
   * the module isn't part of a group, equals `ratios`.
   */
  groupRatios: Map<string, number>;
  /** Σ (groupRatio_M × loc_M) over modules that contributed signal. */
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
  moduleSizes: Map<string, ModuleSize>,
  fileToGroup?: Map<string, string>
): CohesionResult {
  const innerInternal = new Map<string, number>();
  const innerExternal = new Map<string, number>();
  const groupInternal = new Map<string, number>();
  const groupExternal = new Map<string, number>();

  for (const edge of fileEdges) {
    const fromModule = fileToModule.get(edge.fromFile);
    if (fromModule == null) continue;
    const toModule = fileToModule.get(edge.toFile);

    // Inner: counts only edges that stay in the same module.
    if (toModule != null && toModule === fromModule) {
      innerInternal.set(fromModule, (innerInternal.get(fromModule) ?? 0) + 1);
    } else {
      innerExternal.set(fromModule, (innerExternal.get(fromModule) ?? 0) + 1);
    }

    // Workspace-grouped: edges within the same workspace count as internal
    // even when they cross submodule boundaries (controllers → models).
    if (fileToGroup) {
      const fromGroup = fileToGroup.get(edge.fromFile);
      const toGroup = fileToGroup.get(edge.toFile);
      if (fromGroup != null && toGroup != null && fromGroup === toGroup) {
        groupInternal.set(fromModule, (groupInternal.get(fromModule) ?? 0) + 1);
      } else {
        groupExternal.set(fromModule, (groupExternal.get(fromModule) ?? 0) + 1);
      }
    }
  }

  const ratios = new Map<string, number>();
  const groupRatios = new Map<string, number>();
  let cohesionWeighted = 0;
  let moduleLocSum = 0;

  for (const [moduleId, size] of moduleSizes) {
    if (size.fileCount <= 1) continue;

    const i = innerInternal.get(moduleId) ?? 0;
    const e = innerExternal.get(moduleId) ?? 0;
    const total = i + e;
    if (total === 0) continue;
    const innerRatio = i / total;
    ratios.set(moduleId, innerRatio);

    // Score-driving ratio: workspace-grouped when available, otherwise inner.
    let scoreRatio = innerRatio;
    if (fileToGroup) {
      const gi = groupInternal.get(moduleId) ?? 0;
      const ge = groupExternal.get(moduleId) ?? 0;
      const gTotal = gi + ge;
      if (gTotal > 0) scoreRatio = gi / gTotal;
    }
    groupRatios.set(moduleId, scoreRatio);
    cohesionWeighted += scoreRatio * size.loc;
    moduleLocSum += size.loc;
  }

  return { ratios, groupRatios, cohesionWeighted, moduleLocSum };
}
