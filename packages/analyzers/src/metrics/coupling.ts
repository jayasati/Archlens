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
