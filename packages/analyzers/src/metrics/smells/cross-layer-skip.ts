import { smellRule } from '@archlens/shared-types';
import type { Edge, Smell } from '../../ir/types.js';

const RULE = smellRule('cross-layer-skip');

// Layer-classifier heuristic. Layer numbers are arbitrary but ordered.
//   1 = presentation (controllers, views, routes, handlers)
//   2 = service (services, use cases, domain logic)
//   3 = persistence (repositories, daos, models, schemas)
// An edge is a "skip" when it jumps presentation → persistence directly.
const LAYER_PATTERNS: Array<{ layer: number; tokens: string[] }> = [
  {
    layer: 1,
    tokens: ['controller', 'controllers', 'views', 'routes', 'handlers', 'api', 'endpoints'],
  },
  { layer: 2, tokens: ['service', 'services', 'usecases', 'use_cases', 'application'] },
  {
    layer: 3,
    tokens: [
      'repository',
      'repositories',
      'repo',
      'repos',
      'dao',
      'daos',
      'models',
      'schemas',
      'persistence',
    ],
  },
];

export interface CrossLayerSkipInput {
  edges: Edge[];
  moduleNames: Map<string, string>;
  moduleAnchors: Map<string, string>;
}

let counter = 0;

export function detectCrossLayerSkip(input: CrossLayerSkipInput): Smell[] {
  const out: Smell[] = [];
  for (const edge of input.edges) {
    const fromName = input.moduleNames.get(edge.from) ?? edge.from;
    const toName = input.moduleNames.get(edge.to) ?? edge.to;
    const fromLayer = classifyLayer(fromName);
    const toLayer = classifyLayer(toName);
    if (fromLayer === null || toLayer === null) continue;
    // A skip is presentation (1) → persistence (3) without going through (2).
    if (fromLayer !== 1 || toLayer !== 3) continue;

    const anchor = input.moduleAnchors.get(edge.from);
    if (!anchor) continue;
    out.push({
      id: `smell_cross_layer_${++counter}`,
      kind: RULE.kind,
      ruleId: RULE.ruleId,
      severity: 'major',
      message: `Module ${fromName} reaches persistence module ${toName} directly, skipping the service layer`,
      file: anchor,
    });
  }
  return out;
}

function classifyLayer(name: string): number | null {
  const lower = name.toLowerCase();
  for (const { layer, tokens } of LAYER_PATTERNS) {
    for (const t of tokens) {
      if (
        lower === t ||
        lower.endsWith(`.${t}`) ||
        lower.includes(`.${t}.`) ||
        lower.startsWith(`${t}.`)
      ) {
        return layer;
      }
    }
  }
  return null;
}
