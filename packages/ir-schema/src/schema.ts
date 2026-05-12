import { z } from 'zod';
import { IR_VERSION } from './version.js';

export const GradeSchema = z.enum(['A', 'B', 'C', 'D', 'E']);

export const SeveritySchema = z.enum(['info', 'minor', 'major', 'critical']);

export const LanguageSchema = z.enum(['java', 'python', 'typescript', 'javascript']);

export const EdgeKindSchema = z.enum([
  'call',
  'import',
  'inheritance',
  'implements',
  'composition',
  'reference',
]);

const Score100 = z.number().min(0).max(100);
const NonNegInt = z.number().int().nonnegative();

export const LocationSchema = z.object({
  startLine: NonNegInt,
  endLine: NonNegInt,
  startColumn: NonNegInt.optional(),
  endColumn: NonNegInt.optional(),
});

export const SmellSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  ruleId: z.string().min(1),
  severity: SeveritySchema,
  message: z.string().min(1),
  file: z.string().min(1),
  location: LocationSchema.optional(),
  cloneGroupId: z.string().min(1).optional(),
});

export const MethodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  signature: z.string().min(1),
  complexity: NonNegInt,
  cognitive: NonNegInt,
  loc: NonNegInt,
  smells: z.array(SmellSchema).default([]),
});

export const FunctionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  signature: z.string().min(1),
  complexity: NonNegInt,
  cognitive: NonNegInt,
  loc: NonNegInt,
  smells: z.array(SmellSchema).default([]),
});

export const ClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fanIn: NonNegInt.default(0),
  fanOut: NonNegInt.default(0),
  methods: z.array(MethodSchema).default([]),
  smells: z.array(SmellSchema).default([]),
  tags: z.array(z.string()).default([]),
});

export const FileSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  language: LanguageSchema,
  loc: NonNegInt,
  classes: z.array(ClassSchema).default([]),
  functions: z.array(FunctionSchema).default([]),
  smells: z.array(SmellSchema).default([]),
});

export const ModuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  virtual: z.boolean().default(false),
  files: z.array(FileSchema).default([]),
  tags: z.array(z.string()).default([]),
  cohesionRatio: z.number().min(0).max(1).optional(),
  /**
   * Cohesion measured at the workspace level: an edge to a sibling submodule
   * of the same workspace counts as internal. Lets layered MVC apps show
   * meaningful workspace cohesion even when each layer's internal cohesion
   * is 0. When the module isn't sub-split this equals `cohesionRatio`.
   */
  workspaceCohesionRatio: z.number().min(0).max(1).optional(),
  fanIn: NonNegInt.optional(),
  fanOut: NonNegInt.optional(),
  instability: z.number().min(0).max(1).optional(),
  abstractness: z.number().min(0).max(1).optional(),
  martinDistance: z.number().min(0).max(1).optional(),
  /**
   * Optional per-module breakdown. Same shape as the repo-level breakdown so
   * the UI can render module sub-scores with the same component. Mirrored on
   * `ReportModuleScoreDto.scoreBreakdown`.
   */
  scoreBreakdown: z.lazy(() => ScoreBreakdownSchema).optional(),
});

export const EdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: EdgeKindSchema,
  weight: z.number().nonnegative().default(1),
});

export const ScoreBreakdownSchema = z.object({
  complexity: Score100,
  duplication: Score100,
  coupling: Score100,
  cohesion: Score100,
  smells: Score100,
  overall: Score100,
  /**
   * Per-dimension hints when the score is approximate, off, or based on
   * limited signal. Absent keys mean "fully measured, take at face value".
   * UI surfaces this as a chip next to the rating tile so a viewer never
   * mistakes a fallback value for a real measurement.
   */
  measurementNotes: z
    .object({
      complexity: z.string().optional(),
      duplication: z.string().optional(),
      coupling: z.string().optional(),
      cohesion: z.string().optional(),
      smells: z.string().optional(),
    })
    .optional(),
  /**
   * Per-dimension human-readable explanation of how the score was computed.
   * Drives the tooltips on the rating tiles. Absent = no derivation captured.
   */
  derivation: z
    .object({
      complexity: z.string().optional(),
      duplication: z.string().optional(),
      coupling: z.string().optional(),
      cohesion: z.string().optional(),
      smells: z.string().optional(),
    })
    .optional(),
});

/**
 * A dependency cycle in the module graph — a strongly-connected component
 * of size > 1, or a self-loop. Nodes are module IDs in the order returned
 * by the SCC algorithm. UI renders these as "A → B → C → A".
 */
export const CycleSchema = z.object({
  nodes: z.array(z.string().min(1)).min(1),
});

export const RepoSchema = z.object({
  ir_version: z.literal(IR_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  scannedAt: z.string().datetime(),
  languages: z.array(LanguageSchema).min(1),
  modules: z.array(ModuleSchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  cycles: z.array(CycleSchema).optional(),
  scoreBreakdown: ScoreBreakdownSchema,
  grade: GradeSchema,
});
