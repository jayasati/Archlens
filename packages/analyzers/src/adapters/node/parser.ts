import Parser from 'web-tree-sitter';

export type NodeLanguage = 'typescript' | 'tsx' | 'javascript';

let initialized = false;
const cache = new Map<NodeLanguage, Parser.Language>();

const WASM_FILE: Record<NodeLanguage, string> = {
  typescript: 'tree-sitter-wasms/out/tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-wasms/out/tree-sitter-tsx.wasm',
  javascript: 'tree-sitter-wasms/out/tree-sitter-javascript.wasm',
};

export async function getNodeParser(lang: NodeLanguage): Promise<Parser> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }
  let language = cache.get(lang);
  if (!language) {
    const wasmPath = require.resolve(WASM_FILE[lang]);
    language = await Parser.Language.load(wasmPath);
    cache.set(lang, language);
  }
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export function languageForExtension(ext: string): NodeLanguage | null {
  switch (ext.toLowerCase()) {
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.jsx':
      return 'javascript';
    default:
      return null;
  }
}

export type { Parser };
