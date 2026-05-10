import Parser from 'web-tree-sitter';

let initialized = false;
let pythonLang: Parser.Language | null = null;

export async function getPythonParser(): Promise<Parser> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }
  if (!pythonLang) {
    const wasmPath = require.resolve('tree-sitter-wasms/out/tree-sitter-python.wasm');
    pythonLang = await Parser.Language.load(wasmPath);
  }
  const parser = new Parser();
  parser.setLanguage(pythonLang);
  return parser;
}

export type { Parser };
