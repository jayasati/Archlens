import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface JavaParserOutput {
  runner: string;
  javaparserVersion: string;
  repoRoot: string;
  files: ParsedFile[];
  parseErrors: string[];
}

export interface ParsedFile {
  relPath: string;
  packageName: string;
  loc: number;
  imports: ParsedImport[];
  classes: ParsedClass[];
}

export interface ParsedImport {
  name: string;
  isStatic: boolean;
  isAsterisk: boolean;
  startLine: number;
  endLine: number;
}

export interface ParsedClass {
  name: string;
  kind: 'class' | 'interface' | 'enum' | 'annotation';
  isAbstract: boolean;
  startLine: number;
  endLine: number;
  loc: number;
  annotations: string[];
  superclass: string | null;
  implementsList: string[];
  fields: ParsedField[];
  methods: ParsedMethod[];
  constructors: ParsedMethod[];
}

export interface ParsedField {
  name: string;
  type: string;
  annotations: string[];
}

export interface ParsedMethod {
  name: string;
  signature: string;
  isConstructor: boolean;
  isAbstract: boolean;
  isStatic: boolean;
  startLine: number;
  endLine: number;
  loc: number;
  cyclomatic: number;
  cognitive: number;
  maxNestingDepth: number;
  annotations: string[];
  parameters: ParsedParameter[];
}

export interface ParsedParameter {
  name: string;
  type: string;
  annotations: string[];
}

export interface JavaParserRunnerOptions {
  /** Override the default JAR location. */
  jarPath?: string;
  /** Override the java executable name (default: `java` on PATH). */
  javaBin?: string;
  /** Timeout in ms before the JVM is killed (default 5 minutes). */
  timeoutMs?: number;
  /** Optional extra JVM args (e.g. heap size). */
  jvmArgs?: string[];
}

export class JavaNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JavaNotAvailableError';
  }
}

export class JavaParserRunnerError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly exitCode: number | null
  ) {
    super(message);
    this.name = 'JavaParserRunnerError';
  }
}

/**
 * Resolve the bundled JAR. Walks up from this module looking for
 * `tools/parser-jars/javaparser-runner.jar`. Works whether we're running from
 * `src/` (vitest/Vite, transpiled to ESM) or `dist/` (built, CJS).
 *
 * Under vitest the file is loaded as ESM so we fall back to a CWD-based walk
 * when `__dirname` is undefined.
 */
export async function resolveBundledJarPath(): Promise<string> {
  const here = getDirname();
  let dir = here;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, 'tools', 'parser-jars', 'javaparser-runner.jar');
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    'Could not locate tools/parser-jars/javaparser-runner.jar. ' +
      'Rebuild the JAR per tools/parser-jars/README.md.'
  );
}

function getDirname(): string {
  // @types/node declares `__dirname` as a CommonJS global; the `typeof` guard
  // keeps this safe under pure-ESM runtimes where it's not actually bound.
  // The analyzers package compiles to CJS so this is the real path in prod;
  // vitest (Vite ESM transform) also injects __dirname via Vite's CJS interop.
  if (typeof __dirname !== 'undefined') return __dirname;
  return process.cwd();
}

/**
 * Probe whether `java` is on PATH. Returns the version string if so.
 * Throws JavaNotAvailableError otherwise.
 */
export async function probeJava(javaBin = 'java'): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(javaBin, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      reject(new JavaNotAvailableError(`Cannot run '${javaBin}': ${err.message}`));
    });
    child.on('close', (code) => {
      if (code === 0) {
        // `java -version` writes to stderr, weirdly.
        resolve(stderr.split('\n')[0]?.trim() ?? '');
      } else {
        reject(new JavaNotAvailableError(`'${javaBin} -version' exited with code ${code}`));
      }
    });
  });
}

/**
 * Spawn the runner jar against `repoPath` and parse its stdout JSON.
 */
export async function runJavaParserRunner(
  repoPath: string,
  options: JavaParserRunnerOptions = {}
): Promise<JavaParserOutput> {
  const jarPath = options.jarPath ?? (await resolveBundledJarPath());
  const javaBin = options.javaBin ?? 'java';
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const jvmArgs = options.jvmArgs ?? [];

  return new Promise((resolve, reject) => {
    const child = spawn(javaBin, [...jvmArgs, '-jar', jarPath, repoPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new JavaNotAvailableError(`Failed to spawn '${javaBin}': ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (timedOut) {
        reject(
          new JavaParserRunnerError(
            `javaparser-runner timed out after ${timeoutMs}ms`,
            stderr,
            code
          )
        );
        return;
      }
      if (code !== 0) {
        reject(
          new JavaParserRunnerError(`javaparser-runner exited with code ${code}`, stderr, code)
        );
        return;
      }
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      try {
        const parsed = JSON.parse(stdout) as JavaParserOutput;
        resolve(parsed);
      } catch (err) {
        reject(
          new JavaParserRunnerError(
            `javaparser-runner produced non-JSON output: ${(err as Error).message}`,
            stdout.slice(0, 500),
            code
          )
        );
      }
    });
  });
}
