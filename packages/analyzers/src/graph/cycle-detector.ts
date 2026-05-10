import type { DirectedGraph } from 'graphology';

export interface Cycle {
  nodes: string[];
}

export function detectCycles(graph: DirectedGraph): Cycle[] {
  const sccs = stronglyConnectedComponents(graph);
  const cycles: Cycle[] = [];
  for (const scc of sccs) {
    if (scc.length > 1) {
      cycles.push({ nodes: scc });
      continue;
    }
    const node = scc[0]!;
    if (graph.hasEdge(node, node)) {
      cycles.push({ nodes: [node] });
    }
  }
  return cycles;
}

function stronglyConnectedComponents(graph: DirectedGraph): string[][] {
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];
  let index = 0;

  const strongConnect = (node: string): void => {
    indices.set(node, index);
    lowlinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    graph.forEachOutNeighbor(node, (neighbor) => {
      if (!indices.has(neighbor)) {
        strongConnect(neighbor);
        lowlinks.set(node, Math.min(lowlinks.get(node)!, lowlinks.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowlinks.set(node, Math.min(lowlinks.get(node)!, indices.get(neighbor)!));
      }
    });

    if (lowlinks.get(node) === indices.get(node)) {
      const component: string[] = [];
      let popped: string;
      do {
        popped = stack.pop()!;
        onStack.delete(popped);
        component.push(popped);
      } while (popped !== node);
      result.push(component);
    }
  };

  graph.forEachNode((node) => {
    if (!indices.has(node)) strongConnect(node);
  });

  return result;
}
