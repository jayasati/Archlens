import { DirectedGraph } from 'graphology';
import type { EdgeKind } from '../ir/types.js';

export interface GraphEdgeInput {
  from: string;
  to: string;
  kind: EdgeKind;
  weight?: number;
}

export function buildModuleGraph(
  nodes: string[],
  edges: GraphEdgeInput[]
): DirectedGraph<{ id: string }, { kind: EdgeKind; weight: number }> {
  const graph = new DirectedGraph<{ id: string }, { kind: EdgeKind; weight: number }>({
    multi: false,
    allowSelfLoops: true,
  });
  for (const id of nodes) {
    if (!graph.hasNode(id)) graph.addNode(id, { id });
  }
  for (const edge of edges) {
    if (!graph.hasNode(edge.from)) graph.addNode(edge.from, { id: edge.from });
    if (!graph.hasNode(edge.to)) graph.addNode(edge.to, { id: edge.to });
    if (graph.hasEdge(edge.from, edge.to)) {
      const attrs = graph.getEdgeAttributes(edge.from, edge.to);
      graph.setEdgeAttribute(edge.from, edge.to, 'weight', attrs.weight + (edge.weight ?? 1));
    } else {
      graph.addDirectedEdge(edge.from, edge.to, {
        kind: edge.kind,
        weight: edge.weight ?? 1,
      });
    }
  }
  return graph;
}
