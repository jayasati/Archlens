import type { ParsedClass, ParsedFile } from '../runners/javaparser.runner.js';

export type SpringLayer =
  | 'controller'
  | 'service'
  | 'repository'
  | 'component'
  | 'config'
  | 'aspect';

/**
 * Single-annotation classification. Stereotypes win over the generic
 * `@Component`, so order matters: check the specific annotations first.
 */
const ANNOTATION_TO_LAYER: Array<{ annotation: string; layer: SpringLayer }> = [
  { annotation: 'RestController', layer: 'controller' },
  { annotation: 'Controller', layer: 'controller' },
  { annotation: 'Service', layer: 'service' },
  { annotation: 'Repository', layer: 'repository' },
  { annotation: 'Configuration', layer: 'config' },
  { annotation: 'Aspect', layer: 'aspect' },
  // Spring-Boot variants
  { annotation: 'SpringBootApplication', layer: 'config' },
  { annotation: 'EnableAutoConfiguration', layer: 'config' },
  // Generic component is the catch-all; checked last so stereotypes win.
  { annotation: 'Component', layer: 'component' },
];

export interface SpringClassInfo {
  /** Primary layer, or null if no Spring stereotype is present. */
  layer: SpringLayer | null;
  /** Tags suitable for ClassIR.tags (`layer:service`, `spring:Service`, etc.). */
  tags: string[];
}

export function classifySpringClass(cls: ParsedClass): SpringClassInfo {
  const tags: string[] = [];
  let layer: SpringLayer | null = null;

  for (const map of ANNOTATION_TO_LAYER) {
    if (cls.annotations.includes(map.annotation)) {
      if (!layer) layer = map.layer;
      tags.push(`spring:${map.annotation}`);
    }
  }

  if (layer) tags.unshift(`layer:${layer}`);
  return { layer, tags };
}

/**
 * Module-level tag aggregator analogous to the Nest one. Adds `spring-module`
 * to modules that contain a `@Configuration` class, plus `contains:<layer>`
 * for each layer present inside.
 */
export function moduleTagsFromSpringClasses(infos: Iterable<SpringClassInfo>): string[] {
  const out = new Set<string>();
  for (const info of infos) {
    if (info.layer === 'config') out.add('spring-module');
    if (info.layer) out.add(`contains:${info.layer}`);
  }
  return Array.from(out).sort();
}

/** True when the file imports anything from `org.springframework.*`. */
export function fileLooksLikeSpring(file: ParsedFile): boolean {
  return file.imports.some((imp) => imp.name.startsWith('org.springframework'));
}
