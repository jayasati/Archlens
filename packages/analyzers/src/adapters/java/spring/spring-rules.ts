import type { Smell } from '../../../ir/types.js';
import type { BeanGraph, BeanNode } from './bean-graph.js';

export interface SpringRuleSmell extends Smell {
  /** The owning class's bean id, for downstream linking on the UI. */
  beanId: string;
  /** The depended-on bean id when the smell is about a relation. */
  targetBeanId?: string;
}

export interface SpringRulesResult {
  smells: SpringRuleSmell[];
  /** Bean ids involved in any service-only cycle, so the UI can highlight them. */
  cyclicServiceIds: Set<string>;
}

let counter = 0;

/**
 * Apply layered-architecture rules to a bean graph:
 *
 * 1. **Layer skip** — a controller (or generic component) that depends
 *    directly on a repository instead of going through a service.
 * 2. **Service cycle** — a strongly-connected component within the
 *    service-only sub-graph (services A and B injecting each other).
 *
 * Both emit standard `Smell` objects that flow through existing IR + UI
 * paths; layer-skip smells carry the offending field/parameter type in the
 * message so devs can jump straight to the call site.
 */
export function applySpringRules(graph: BeanGraph): SpringRulesResult {
  const smells: SpringRuleSmell[] = [];
  const cyclicServiceIds = new Set<string>();

  for (const edge of graph.edges) {
    const from = graph.byId.get(edge.fromId);
    const to = graph.byId.get(edge.toId);
    if (!from || !to) continue;
    if (isControllerLike(from) && to.layer === 'repository') {
      smells.push(makeLayerSkip(from, to, edge.typeName));
    }
  }

  const serviceCycles = detectServiceCycles(graph);
  for (const scc of serviceCycles) {
    for (const id of scc) cyclicServiceIds.add(id);
    smells.push(makeServiceCycle(scc, graph));
  }

  return { smells, cyclicServiceIds };
}

function isControllerLike(node: BeanNode): boolean {
  // Generic `@Component` classes are often controllers in practice; we flag
  // them too because a @Component reaching into a repository is the same
  // architectural problem as a @Controller doing it.
  return node.layer === 'controller' || node.layer === 'component';
}

function makeLayerSkip(from: BeanNode, to: BeanNode, typeName: string): SpringRuleSmell {
  return {
    id: `smell_spring_layer_skip_${++counter}`,
    kind: 'spring-layer-skip',
    ruleId: 'spring-layer-skip',
    severity: 'major',
    message:
      `${from.layer ?? 'class'} ${from.simpleName} depends directly on repository ${to.simpleName} ` +
      `(via ${typeName}). Route the call through a service instead.`,
    file: from.filePath,
    beanId: from.id,
    targetBeanId: to.id,
  };
}

function makeServiceCycle(cycle: string[], graph: BeanGraph): SpringRuleSmell {
  const head = graph.byId.get(cycle[0]!);
  const names = cycle.map((id) => graph.byId.get(id)?.simpleName ?? id);
  return {
    id: `smell_spring_service_cycle_${++counter}`,
    kind: 'spring-service-cycle',
    ruleId: 'spring-service-cycle',
    severity: 'major',
    message: `Service-layer dependency cycle: ${names.join(' -> ')} -> ${names[0]}`,
    file: head?.filePath ?? 'unknown',
    beanId: head?.id ?? cycle[0]!,
  };
}

/**
 * Tarjan SCC on the service-only sub-graph. Returns SCCs with size >= 2
 * (true cycles, not the single-node trivial components).
 */
function detectServiceCycles(graph: BeanGraph): string[][] {
  const serviceIds = new Set<string>();
  for (const node of graph.nodes) {
    if (node.layer === 'service') serviceIds.add(node.id);
  }

  const adjacency = new Map<string, string[]>();
  for (const id of serviceIds) adjacency.set(id, []);
  for (const edge of graph.edges) {
    if (!serviceIds.has(edge.fromId) || !serviceIds.has(edge.toId)) continue;
    adjacency.get(edge.fromId)!.push(edge.toId);
  }

  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];
  let index = 0;

  const strongConnect = (v: string): void => {
    indices.set(v, index);
    lowlinks.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) result.push(component);
      else if (adjacency.get(v)?.includes(v)) result.push(component);
    }
  };

  for (const v of serviceIds) {
    if (!indices.has(v)) strongConnect(v);
  }
  return result;
}
