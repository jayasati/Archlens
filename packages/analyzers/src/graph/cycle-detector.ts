import type { DirectedGraph } from 'graphology';

export interface CycleEdge {
  from: string;
  to: string;
}

export interface Cycle {
  /**
   * All nodes in the strongly-connected component. Order is the SCC algorithm's
   * pop order and does NOT trace real edges — use `representativePath` for a
   * trustworthy "A → B → … → A" rendering.
   */
  nodes: string[];
  /**
   * Every real directed edge among the SCC members. Lets the UI prove that
   * the SCC really is cyclic by listing concrete back-edges.
   */
  edges: CycleEdge[];
  /**
   * A concrete simple cycle through real edges. First and last entries are
   * always equal so the loop is visually closed (e.g. `['bot', 'data', 'bot']`).
   * For SCCs larger than 2 this is the shortest simple cycle that lives inside
   * the SCC — enough to demonstrate the cycle without claiming the visit order
   * covers every member.
   */
  representativePath: string[];
}

export function detectCycles(graph: DirectedGraph): Cycle[] {
  const sccs = stronglyConnectedComponents(graph);
  const cycles: Cycle[] = [];
  for (const scc of sccs) {
    if (scc.length > 1) {
      const members = new Set(scc);
      const edges = collectIntraSccEdges(graph, members);
      const representativePath = shortestSimpleCycle(graph, members) ?? [scc[0]!, scc[0]!];
      cycles.push({ nodes: scc, edges, representativePath });
      continue;
    }
    const node = scc[0]!;
    if (graph.hasEdge(node, node)) {
      cycles.push({
        nodes: [node],
        edges: [{ from: node, to: node }],
        representativePath: [node, node],
      });
    }
  }
  return cycles;
}

function collectIntraSccEdges(graph: DirectedGraph, members: ReadonlySet<string>): CycleEdge[] {
  const out: CycleEdge[] = [];
  for (const node of members) {
    graph.forEachOutNeighbor(node, (neighbor) => {
      if (members.has(neighbor)) out.push({ from: node, to: neighbor });
    });
  }
  return out;
}

/**
 * BFS from each SCC member to find the shortest closed walk back to the
 * starting node, restricted to edges that stay inside the SCC. Returns the
 * cycle as a node sequence with the start node repeated at the end. The SCC
 * guarantees at least one such walk exists, so a non-null result is expected.
 */
function shortestSimpleCycle(graph: DirectedGraph, members: ReadonlySet<string>): string[] | null {
  let best: string[] | null = null;
  for (const start of members) {
    const path = shortestCycleFrom(graph, members, start);
    if (path && (best === null || path.length < best.length)) {
      best = path;
      if (best.length === 3) break; // 2-cycle is the shortest possible
    }
  }
  return best;
}

function shortestCycleFrom(
  graph: DirectedGraph,
  members: ReadonlySet<string>,
  start: string
): string[] | null {
  const parents = new Map<string, string>();
  const visited = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    let closed: string | null = null;
    graph.forEachOutNeighbor(node, (neighbor) => {
      if (!members.has(neighbor)) return;
      if (neighbor === start) {
        if (closed === null) closed = node;
        return;
      }
      if (visited.has(neighbor)) return;
      visited.add(neighbor);
      parents.set(neighbor, node);
      queue.push(neighbor);
    });
    if (closed !== null) {
      // Reconstruct closed → … → start by walking parents back to `start`.
      const path: string[] = [start];
      const stack: string[] = [];
      let cur: string | undefined = closed;
      while (cur !== undefined && cur !== start) {
        stack.push(cur);
        cur = parents.get(cur);
      }
      while (stack.length > 0) path.push(stack.pop()!);
      path.push(start);
      return path;
    }
  }
  return null;
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
