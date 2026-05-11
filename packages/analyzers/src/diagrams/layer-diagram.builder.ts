import type { ClassIR, Edge, Module } from '../ir/types.js';

/**
 * Mermaid `graph TD` showing each tagged class as a node colored by its layer
 * tag, grouped into one subgraph per IR module. Inter-module import edges are
 * drawn between the first tagged class of each module so the layered shape
 * remains visible — for v1 we deliberately don't try to compute true
 * class-to-class dependency edges.
 */
export function buildMermaidLayerDiagram(modules: Module[], edges: Edge[]): string {
  const lines: string[] = ['graph TD'];

  // Class definitions for the supported layer tags. Colors track the design-system
  // palette loosely; consumers can override via the rendered .css.
  lines.push('  classDef controller fill:#ef4444,stroke:#b91c1c,color:#fff');
  lines.push('  classDef service fill:#3b82f6,stroke:#1d4ed8,color:#fff');
  lines.push('  classDef module fill:#10b981,stroke:#047857,color:#fff');
  lines.push('  classDef gateway fill:#8b5cf6,stroke:#6d28d9,color:#fff');
  lines.push('  classDef guard fill:#f59e0b,stroke:#b45309,color:#000');
  lines.push('  classDef pipe fill:#06b6d4,stroke:#0e7490,color:#fff');
  lines.push('  classDef interceptor fill:#ec4899,stroke:#be185d,color:#fff');
  lines.push('  classDef filter fill:#64748b,stroke:#334155,color:#fff');
  lines.push('  classDef provider fill:#94a3b8,stroke:#475569,color:#000');
  lines.push('  classDef untagged fill:#e2e8f0,stroke:#94a3b8,color:#0f172a');

  const classNodeId = new Map<string, string>(); // ClassIR.id -> safe id
  const moduleAnchor = new Map<string, string>(); // Module.id -> first tagged class node id

  for (const mod of modules) {
    const tagged = collectTaggedClasses(mod);
    if (tagged.length === 0) continue;

    const safeMod = sanitizeId(mod.id);
    const moduleLabel = escapeLabel(
      `${mod.name}${mod.tags.length > 0 ? '\\n[' + mod.tags.join(',') + ']' : ''}`
    );
    lines.push(`  subgraph ${safeMod}["${moduleLabel}"]`);

    for (const cls of tagged) {
      const safeCls = sanitizeId(`${mod.id}_${cls.id}`);
      classNodeId.set(cls.id, safeCls);
      const layer = layerFromTags(cls.tags) ?? 'untagged';
      lines.push(`    ${safeCls}["${escapeLabel(cls.name)}"]:::${layer}`);
      if (!moduleAnchor.has(mod.id)) moduleAnchor.set(mod.id, safeCls);
    }

    lines.push('  end');
  }

  for (const edge of edges) {
    const from = moduleAnchor.get(edge.from);
    const to = moduleAnchor.get(edge.to);
    if (!from || !to) continue;
    if (from === to) continue;
    lines.push(`  ${from} -->|${edge.kind}| ${to}`);
  }

  return lines.join('\n');
}

function collectTaggedClasses(mod: Module): ClassIR[] {
  const out: ClassIR[] = [];
  for (const file of mod.files) {
    for (const cls of file.classes) {
      if (cls.tags && cls.tags.length > 0) out.push(cls);
    }
  }
  return out;
}

function layerFromTags(tags: string[]): string | null {
  for (const tag of tags) {
    if (tag.startsWith('layer:')) return tag.slice('layer:'.length);
  }
  return null;
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"');
}
