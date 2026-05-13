import { smellRule } from '@archlens/shared-types';
import type { Cycle, Smell } from '../../ir/types.js';

const RULE = smellRule('cyclic-dependencies');

export interface CyclicDependenciesInput {
  cycles: Cycle[];
  // Maps module id → an arbitrary file inside it so the smell can anchor on
  // a real path (smells without a file are filtered out by some UI views).
  moduleAnchors: Map<string, string>;
  moduleNames: Map<string, string>;
}

let counter = 0;

export function detectCyclicDependencies(input: CyclicDependenciesInput): Smell[] {
  const out: Smell[] = [];
  for (const cycle of input.cycles) {
    if (cycle.nodes.length === 0) continue;
    const first = cycle.nodes[0]!;
    const anchor = input.moduleAnchors.get(first) ?? '';
    if (!anchor) continue;
    const nameOf = (id: string): string => input.moduleNames.get(id) ?? id;
    // Use the concrete shortest cycle (`representativePath`) when available
    // so the message reflects real edges, not arbitrary SCC ordering. The
    // path is closed (last === first), so no extra wrap-around needed.
    const display = cycle.representativePath
      ? cycle.representativePath.map(nameOf).join(' → ')
      : `${cycle.nodes.map(nameOf).join(', ')} (cyclic)`;
    out.push({
      id: `smell_cycle_${++counter}`,
      kind: RULE.kind,
      ruleId: RULE.ruleId,
      severity: cycle.nodes.length >= 4 ? 'critical' : 'major',
      message: `Module cycle: ${display}`,
      file: anchor,
    });
  }
  return out;
}
