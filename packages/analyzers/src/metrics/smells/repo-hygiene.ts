import { promises as fs } from 'node:fs';
import path from 'node:path';
import { smellRule } from '@archlens/shared-types';
import type { Smell } from '../../ir/types.js';

// Catalog rules used by this module — registered at import time so a missing
// catalog entry fails loudly.
const MISSING_README = smellRule('missing-readme');
const MISSING_CI = smellRule('missing-ci');
const MISSING_LINTER = smellRule('missing-linter-config');
const MISSING_LOCKFILE = smellRule('missing-lockfile');
const BUILD_ARTIFACTS = smellRule('build-artifacts-committed');
const LARGE_BINARY = smellRule('large-binary-file');

const README_NAMES = ['README.md', 'README.rst', 'README.txt', 'README'];

const CI_PATHS = [
  '.github/workflows',
  '.gitlab-ci.yml',
  '.circleci/config.yml',
  '.travis.yml',
  'azure-pipelines.yml',
  'Jenkinsfile',
];

const LINTER_CONFIGS = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.js',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yml',
  'eslint.config.js',
  'eslint.config.mjs',
  '.flake8',
  'setup.cfg',
  'ruff.toml',
  '.ruff.toml',
  'pyproject.toml', // checked further for [tool.ruff]/[tool.black]/[tool.flake8]
];

const BUILD_DIRS = new Set([
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'target', // java
  'bin',
]);

// We don't walk these by default — they're virtualenvs / VCS / vendored deps.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '.tox']);

const BINARY_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.tiff',
  '.ico',
  '.webp',
  '.mp3',
  '.mp4',
  '.mov',
  '.avi',
  '.wav',
  '.flac',
  '.ogg',
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.rar',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.jar',
  '.war',
  '.psd',
  '.ai',
  '.sketch',
  '.pdf',
]);

export interface RepoHygieneInput {
  repoPath: string;
}

export interface RepoHygieneThresholds {
  largeBinaryBytes: number;
}

let counter = 0;
const nextId = (kind: string): string => `smell_${kind}_${++counter}`;

export async function detectRepoHygiene(
  input: RepoHygieneInput,
  thresholds: RepoHygieneThresholds
): Promise<Smell[]> {
  const root = path.resolve(input.repoPath);
  const out: Smell[] = [];

  const rootEntries = await fs.readdir(root, { withFileTypes: true });
  const rootNames = new Set(rootEntries.map((e) => e.name));

  if (!README_NAMES.some((n) => rootNames.has(n))) {
    out.push({
      id: nextId('missing_readme'),
      kind: MISSING_README.kind,
      ruleId: MISSING_README.ruleId,
      severity: 'info',
      message: 'No README found at the repo root',
      file: 'README.md',
    });
  }

  if (!(await anyCiConfig(root, rootNames))) {
    out.push({
      id: nextId('missing_ci'),
      kind: MISSING_CI.kind,
      ruleId: MISSING_CI.ruleId,
      severity: 'info',
      message:
        'No CI configuration detected (looked for GitHub Actions, GitLab, CircleCI, Travis, Jenkins, Azure)',
      file: '.github/workflows/',
    });
  }

  if (!(await anyLinterConfig(root, rootNames))) {
    out.push({
      id: nextId('missing_linter'),
      kind: MISSING_LINTER.kind,
      ruleId: MISSING_LINTER.ruleId,
      severity: 'info',
      message: 'No linter or formatter configuration found at the repo root',
      file: rootNames.has('pyproject.toml') ? 'pyproject.toml' : 'package.json',
    });
  }

  out.push(...detectMissingLockfiles(rootNames));

  const walkResults = await walkForArtifactsAndBinaries(root, thresholds.largeBinaryBytes);
  for (const dir of walkResults.buildDirs) {
    out.push({
      id: nextId('build_artifacts'),
      kind: BUILD_ARTIFACTS.kind,
      ruleId: BUILD_ARTIFACTS.ruleId,
      severity: 'minor',
      message: `Build artifact directory committed: ${dir}`,
      file: dir,
    });
  }
  for (const bin of walkResults.largeBinaries) {
    out.push({
      id: nextId('large_binary'),
      kind: LARGE_BINARY.kind,
      ruleId: LARGE_BINARY.ruleId,
      severity: bin.size >= thresholds.largeBinaryBytes * 5 ? 'major' : 'minor',
      message: `Large binary file (${formatBytes(bin.size)}) committed: ${bin.relPath}`,
      file: bin.relPath,
    });
  }

  return out;
}

async function anyCiConfig(root: string, rootNames: Set<string>): Promise<boolean> {
  for (const candidate of CI_PATHS) {
    const abs = path.join(root, candidate);
    try {
      const stat = await fs.stat(abs);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(abs);
        if (entries.length > 0) return true;
      } else if (stat.isFile()) {
        return true;
      }
    } catch {
      // not present — keep looking
    }
  }
  // tolerate a top-level ".github" with anything in it (e.g. issue templates
  // alone don't run CI, so we still only count workflows above)
  void rootNames;
  return false;
}

async function anyLinterConfig(root: string, rootNames: Set<string>): Promise<boolean> {
  for (const cfg of LINTER_CONFIGS) {
    if (!rootNames.has(cfg)) continue;
    if (cfg !== 'pyproject.toml' && cfg !== 'setup.cfg') return true;
    try {
      const text = await fs.readFile(path.join(root, cfg), 'utf8');
      if (/\[tool\.(ruff|black|flake8|isort)\]/i.test(text)) return true;
      if (/\[flake8\]/i.test(text)) return true;
    } catch {
      // ignore unreadable
    }
  }
  return false;
}

function detectMissingLockfiles(rootNames: Set<string>): Smell[] {
  const out: Smell[] = [];

  if (rootNames.has('package.json')) {
    const hasLock =
      rootNames.has('pnpm-lock.yaml') ||
      rootNames.has('package-lock.json') ||
      rootNames.has('yarn.lock') ||
      rootNames.has('npm-shrinkwrap.json');
    if (!hasLock) {
      out.push({
        id: nextId('missing_lockfile_node'),
        kind: MISSING_LOCKFILE.kind,
        ruleId: MISSING_LOCKFILE.ruleId,
        severity: 'minor',
        message:
          'package.json found but no lockfile (pnpm-lock.yaml / package-lock.json / yarn.lock)',
        file: 'package.json',
      });
    }
  }

  if (rootNames.has('pyproject.toml')) {
    const hasLock =
      rootNames.has('poetry.lock') ||
      rootNames.has('uv.lock') ||
      rootNames.has('pdm.lock') ||
      rootNames.has('requirements.txt');
    if (!hasLock) {
      out.push({
        id: nextId('missing_lockfile_py'),
        kind: MISSING_LOCKFILE.kind,
        ruleId: MISSING_LOCKFILE.ruleId,
        severity: 'minor',
        message:
          'pyproject.toml found but no lockfile (poetry.lock / uv.lock / pdm.lock / requirements.txt)',
        file: 'pyproject.toml',
      });
    }
  }

  return out;
}

interface WalkResult {
  buildDirs: string[];
  largeBinaries: Array<{ relPath: string; size: number }>;
}

async function walkForArtifactsAndBinaries(
  root: string,
  largeBinaryBytes: number
): Promise<WalkResult> {
  const buildDirs = new Set<string>();
  const largeBinaries: Array<{ relPath: string; size: number }> = [];

  const walk = async (dir: string): Promise<void> => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (BUILD_DIRS.has(entry.name)) {
          buildDirs.add(rel);
          continue; // don't recurse into a build dir
        }
        await walk(abs);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!BINARY_EXTS.has(ext)) continue;
        try {
          const stat = await fs.stat(abs);
          if (stat.size >= largeBinaryBytes) {
            largeBinaries.push({ relPath: rel, size: stat.size });
          }
        } catch {
          // ignore
        }
      }
    }
  };

  await walk(root);
  return { buildDirs: Array.from(buildDirs).sort(), largeBinaries };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
