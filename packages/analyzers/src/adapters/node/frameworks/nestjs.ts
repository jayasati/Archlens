import type { ParsedClass, ParsedFile } from '../ast-walker.js';

export type NestLayer =
  | 'controller'
  | 'service'
  | 'module'
  | 'gateway'
  | 'guard'
  | 'pipe'
  | 'interceptor'
  | 'filter'
  | 'middleware'
  | 'resolver'
  | 'provider';

const PRIMARY_DECORATOR_TO_LAYER: Record<string, NestLayer> = {
  Controller: 'controller',
  WebSocketGateway: 'gateway',
  Module: 'module',
  Catch: 'filter',
  Resolver: 'resolver',
  Mutation: 'resolver',
  Query: 'resolver',
};

const SUFFIX_TO_LAYER: Array<{ suffix: string; layer: NestLayer }> = [
  { suffix: 'Service', layer: 'service' },
  { suffix: 'Repository', layer: 'service' },
  { suffix: 'Guard', layer: 'guard' },
  { suffix: 'Pipe', layer: 'pipe' },
  { suffix: 'Interceptor', layer: 'interceptor' },
  { suffix: 'Filter', layer: 'filter' },
  { suffix: 'Middleware', layer: 'middleware' },
  { suffix: 'Resolver', layer: 'resolver' },
  { suffix: 'Strategy', layer: 'service' },
];

export interface NestClassInfo {
  layer: NestLayer | null;
  tags: string[];
}

/**
 * Decide a layer + tags for a class based on its decorators (and class name as
 * a tiebreaker for the catch-all `@Injectable`).
 */
export function classifyNestClass(cls: ParsedClass): NestClassInfo {
  const tags: string[] = [];
  let layer: NestLayer | null = null;

  for (const dec of cls.decorators) {
    const direct = PRIMARY_DECORATOR_TO_LAYER[dec];
    if (direct) {
      layer = layer ?? direct;
      tags.push(`nest:${dec.toLowerCase()}`);
    }
  }

  if (!layer && cls.decorators.includes('Injectable')) {
    const fromName = SUFFIX_TO_LAYER.find((s) => cls.name.endsWith(s.suffix));
    layer = fromName ? fromName.layer : 'provider';
    tags.push('nest:injectable');
  }

  if (layer && !tags.includes(`layer:${layer}`)) {
    tags.unshift(`layer:${layer}`);
  }

  return { layer, tags };
}

/**
 * Heuristic detector — true when the file imports anything from `@nestjs/*`.
 * The orchestrator can use this at a repo level to decide whether to enable
 * Nest-specific reporting.
 */
export function fileLooksLikeNest(file: ParsedFile): boolean {
  return file.imports.some((imp) => imp.source.startsWith('@nestjs/'));
}

/**
 * Returns module-level tags for an IR module given the classes inside it.
 * Currently: presence of an `@Module`-decorated class promotes the module
 * to `nest-module`, plus the union of layer tags of its members so the
 * frontend can color modules by primary purpose.
 */
export function moduleTagsFromClasses(classInfos: Iterable<NestClassInfo>): string[] {
  const tags = new Set<string>();
  for (const info of classInfos) {
    if (info.layer === 'module') tags.add('nest-module');
    if (info.layer) tags.add(`contains:${info.layer}`);
  }
  return Array.from(tags).sort();
}
