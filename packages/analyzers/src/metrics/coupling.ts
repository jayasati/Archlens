export interface CouplingResult {
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
}

export function computeCoupling(edges: Array<{ from: string; to: string }>): CouplingResult {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
  }
  return { fanIn, fanOut };
}

export interface CouplingSummary {
  /** Largest fan-out across modules (for the hub penalty). */
  fanOutMax: number;
  /** Largest fan-in × fan-out across modules — flags "dual hub" god-modules. */
  dualHubMax: number;
}

/**
 * For each module in `modulesById`, stamp `fanIn`, `fanOut`, and `instability`
 * from the coupling result. Modules with no edges in either direction get
 * fanIn/fanOut = 0 and `instability` left undefined (no signal).
 */
export function enrichModuleCoupling(
  modules: Array<{ id: string; fanIn?: number; fanOut?: number; instability?: number }>,
  coupling: CouplingResult
): CouplingSummary {
  let fanOutMax = 0;
  let dualHubMax = 0;
  for (const mod of modules) {
    const fIn = coupling.fanIn.get(mod.id) ?? 0;
    const fOut = coupling.fanOut.get(mod.id) ?? 0;
    mod.fanIn = fIn;
    mod.fanOut = fOut;
    const total = fIn + fOut;
    mod.instability = total > 0 ? fOut / total : undefined;
    if (fOut > fanOutMax) fanOutMax = fOut;
    const dual = fIn * fOut;
    if (dual > dualHubMax) dualHubMax = dual;
  }
  return { fanOutMax, dualHubMax };
}

export interface ModuleTypeCounts {
  /** All declared types (classes + interfaces; enums/annotations included). */
  total: number;
  /** Abstract types (interfaces + abstract classes; annotations count as abstract). */
  abstract: number;
}

/**
 * Stamp `abstractness` and Robert Martin's `martinDistance = |A + I - 1|` on
 * each module. Requires `instability` to already be set (call after
 * `enrichModuleCoupling`). Modules below `minTypes` are skipped so trivial
 * leaf modules can't drag the score into the "zone of pain".
 */
export function enrichModuleAbstractness(
  modules: Array<{
    id: string;
    instability?: number;
    abstractness?: number;
    martinDistance?: number;
  }>,
  typeCounts: Map<string, ModuleTypeCounts>,
  minTypes = 3
): void {
  for (const mod of modules) {
    const counts = typeCounts.get(mod.id);
    if (!counts || counts.total < minTypes) continue;
    const a = counts.total === 0 ? 0 : counts.abstract / counts.total;
    mod.abstractness = a;
    if (mod.instability === undefined) continue;
    mod.martinDistance = Math.abs(a + mod.instability - 1);
  }
}
