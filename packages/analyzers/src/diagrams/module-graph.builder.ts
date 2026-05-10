import type { Edge, Module } from '../ir/types.js';

export function buildMermaidModuleGraph(modules: Module[], edges: Edge[]): string {
  const lines: string[] = ['graph LR'];
  const safeIds = new Map<string, string>();
  for (const mod of modules) {
    const safe = sanitizeId(mod.id);
    safeIds.set(mod.id, safe);
    lines.push(`  ${safe}["${escapeLabel(mod.name)}"]`);
  }
  for (const edge of edges) {
    const from = safeIds.get(edge.from);
    const to = safeIds.get(edge.to);
    if (!from || !to) continue;
    lines.push(`  ${from} -->|${edge.kind}| ${to}`);
  }
  return lines.join('\n');
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"');
}
