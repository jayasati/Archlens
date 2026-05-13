import type { Cycle, Module, Smell } from '../ir/types.js';
import { computeModuleScores } from './engine.js';

/**
 * Mutates each module in `modules` with a `scoreBreakdown` field. Aggregates
 * per-module hot-spot density (using the same complexity threshold as the
 * repo-level scorer) and per-module smells (matched by `Smell.file` against
 * the module's file paths).
 */
export function stampModuleScores(
  modules: Module[],
  smells: Smell[],
  cycles: Cycle[],
  longMethodComplexity: number
): void {
  const modulesInCycle = new Set<string>();
  for (const cycle of cycles) for (const node of cycle.nodes) modulesInCycle.add(node);

  const smellsByFile = new Map<string, Smell[]>();
  for (const s of smells) {
    const list = smellsByFile.get(s.file);
    if (list) list.push(s);
    else smellsByFile.set(s.file, [s]);
  }

  for (const mod of modules) {
    const modSmells: Smell[] = [];
    let modHotSpotCount = 0;
    let modHotSpotExcess = 0;
    let modLoc = 0;
    let modFunctions = 0;
    let modComplexity = 0;
    for (const file of mod.files) {
      modLoc += file.loc;
      const fileSmells = smellsByFile.get(file.path);
      if (fileSmells) modSmells.push(...fileSmells);
      for (const fn of file.functions) {
        modFunctions += 1;
        modComplexity += fn.complexity;
        if (fn.complexity > longMethodComplexity) {
          modHotSpotCount += 1;
          modHotSpotExcess += fn.complexity - longMethodComplexity;
        }
      }
      for (const cls of file.classes) {
        for (const m of cls.methods) {
          modFunctions += 1;
          modComplexity += m.complexity;
          if (m.complexity > longMethodComplexity) {
            modHotSpotCount += 1;
            modHotSpotExcess += m.complexity - longMethodComplexity;
          }
        }
      }
    }
    mod.scoreBreakdown = computeModuleScores({
      totalLoc: modLoc,
      totalFunctions: modFunctions,
      totalComplexity: modComplexity,
      hotSpotCount: modHotSpotCount,
      hotSpotExcess: modHotSpotExcess,
      fanIn: mod.fanIn ?? 0,
      fanOut: mod.fanOut ?? 0,
      instability: mod.instability,
      martinDistance: mod.martinDistance,
      cohesionRatio: mod.cohesionRatio,
      smells: modSmells,
      inCycle: modulesInCycle.has(mod.id),
    });
  }
}
