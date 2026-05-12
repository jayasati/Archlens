import type { ReportModuleScoreDto } from '@archlens/shared-types';

export type ModuleShape =
  | 'dual-hub'
  | 'stable-provider'
  | 'pure-consumer'
  | 'entrypoint'
  | 'leaf'
  | 'standard';

export interface ModuleShapeBadge {
  shape: ModuleShape;
  label: string;
  /** Tailwind colour utility for the chip. */
  color: string;
  /** Short tooltip explaining why this label applies. */
  description: string;
}

/**
 * Derive a structural shape from a module's coupling signal. The badges turn
 * raw fanIn / fanOut / instability numbers into actionable architectural
 * categories — "god module", "stable provider", etc. Returns null when the
 * module doesn't fit any non-trivial category.
 */
export function classifyModuleShape(m: ReportModuleScoreDto): ModuleShapeBadge | null {
  const fanIn = m.fanIn ?? 0;
  const fanOut = m.fanOut ?? 0;
  const instab = m.instability;
  // Dual hub: depended on AND depends widely. Classic god-module signal.
  if (fanIn >= 3 && fanOut >= 3) {
    return {
      shape: 'dual-hub',
      label: 'dual hub',
      color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
      description: `Depended on by ${fanIn} other modules AND depends on ${fanOut} — classic god-module shape. Worth splitting.`,
    };
  }
  // Stable provider: depended on, doesn't depend on others. Healthy data/types layer.
  if (fanIn >= 2 && fanOut === 0) {
    return {
      shape: 'stable-provider',
      label: 'stable provider',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      description: `Depended on by ${fanIn} modules with no outgoing deps — a healthy stable provider (typical for data / types / utils).`,
    };
  }
  // Pure consumer: depends on others, nothing depends back. App-layer code.
  if (fanIn === 0 && fanOut >= 2) {
    const isEntrypoint = /(^|\W)(scripts?|bin|cli|main|cmd|app|entrypoint)(\W|$)/i.test(m.name);
    if (isEntrypoint) {
      return {
        shape: 'entrypoint',
        label: 'entrypoint',
        color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
        description: `Imports from ${fanOut} other modules, nothing imports it — looks like an entrypoint / runner module.`,
      };
    }
    return {
      shape: 'pure-consumer',
      label: 'pure consumer',
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      description: `Imports from ${fanOut} other modules, nothing imports it back. Volatile by Martin’s definition (I=1).`,
    };
  }
  // Stable but only depended on once — still notable.
  if (fanIn >= 1 && fanOut === 0 && (instab ?? 1) <= 0.2) {
    return {
      shape: 'leaf',
      label: 'leaf',
      color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      description: `No outgoing deps. Self-contained leaf module.`,
    };
  }
  return null;
}
