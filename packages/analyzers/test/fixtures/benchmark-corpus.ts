import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Sample projects live at <repoRoot>/sample-projects/<name>. Walk up from
// here to the repo root so the corpus runner works from anywhere.
const repoRoot = path.resolve(here, '../../../../..');

export interface BenchmarkRepo {
  /** Stable identifier — used as the key in the snapshot JSON. */
  key: string;
  /** Display name. */
  name: string;
  /** Absolute path on disk. */
  path: string;
  /** Short note describing what this repo exercises. */
  rationale: string;
}

export const BENCHMARK_CORPUS: BenchmarkRepo[] = [
  {
    key: 'internshipPortal',
    name: 'internshipPortal-main',
    path: path.join(repoRoot, 'sample-projects', 'internshipPortal-main'),
    rationale:
      'Node-only MERN student project. Modern arrow-function controllers + React. Validates the arrow + asyncHandler patterns.',
  },
  {
    key: 'stockTrading',
    name: 'Stock-Trading-Simulation-System-main',
    path: path.join(repoRoot, 'sample-projects', 'Stock-Trading-Simulation-System-main'),
    rationale:
      'Polyglot Spring Boot + JS frontend. Validates cross-language scoring, the Maven static-asset exclusion, and Spring layer rules.',
  },
  {
    key: 'stockBot',
    name: 'StockBOT-main',
    path: path.join(repoRoot, 'sample-projects', 'StockBOT-main'),
    rationale: 'Third Node sample to widen coverage and catch regressions specific to one repo.',
  },
];
