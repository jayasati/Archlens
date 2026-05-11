import type { ParsedFile } from '../ast-walker.js';

export type NextRouterKind = 'app' | 'pages';

export interface NextRoute {
  kind: NextRouterKind;
  /** URL path derived from the file location, e.g. `/repos/[owner]/[name]/architecture`. */
  urlPath: string;
  /** Source file. */
  file: string;
  /** Layer tag — "page", "layout", "route", "api". */
  layer: 'page' | 'layout' | 'route' | 'api';
}

/** True when the relative path lives under a Next.js `app/` or `pages/` tree. */
export function fileLooksLikeNext(relPath: string): NextRouterKind | null {
  const norm = relPath.replace(/\\/g, '/');
  if (/(^|\/)app\//.test(norm)) return 'app';
  if (/(^|\/)pages\//.test(norm)) return 'pages';
  return null;
}

/**
 * Stub route extractor — derives the route from the file path alone (the
 * actual Next.js convention). Doesn't yet read `route.ts` HTTP handlers
 * exported as `GET`, `POST`, etc.
 */
export function extractNextRoute(file: ParsedFile): NextRoute | null {
  const kind = fileLooksLikeNext(file.relPath);
  if (!kind) return null;

  const norm = file.relPath.replace(/\\/g, '/');
  const fileName = norm.split('/').pop() ?? '';
  const layer = layerForFileName(fileName, kind);
  if (!layer) return null;

  const urlPath = pathFromFileLocation(norm, kind);
  return { kind, urlPath, file: file.relPath, layer };
}

function layerForFileName(name: string, kind: NextRouterKind): NextRoute['layer'] | null {
  const base = name.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');
  if (kind === 'app') {
    if (base === 'page') return 'page';
    if (base === 'layout') return 'layout';
    if (base === 'route') return 'route';
  } else {
    // pages/api/* are API routes; everything else is a page module.
    if (/(^|\/)api\//.test(name)) return 'api';
    return 'page';
  }
  return null;
}

function pathFromFileLocation(relPath: string, kind: NextRouterKind): string {
  const marker = kind === 'app' ? '/app/' : '/pages/';
  const idx = relPath.indexOf(marker);
  const tail = idx >= 0 ? relPath.slice(idx + marker.length) : relPath;
  // strip leading group segments like (auth)/, file extension, and trailing /page|/route|/layout
  const segments = tail
    .split('/')
    .filter((s) => s.length > 0 && !/^\(.+\)$/.test(s))
    .map((s) => s.replace(/\.(tsx?|jsx?|mjs|cjs)$/, ''));
  if (kind === 'app' && segments.length > 0) {
    const last = segments[segments.length - 1];
    if (last === 'page' || last === 'layout' || last === 'route') segments.pop();
  } else if (kind === 'pages' && segments.length > 0) {
    if (segments[segments.length - 1] === 'index') segments.pop();
  }
  return '/' + segments.join('/');
}
