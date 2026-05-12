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
  fanIn: NonNegInt.optional(),
  fanOut: NonNegInt.optional(),
  instability: z.number().min(0).max(1).optional(),
  abstractness: z.number().min(0).max(1).optional(),
  martinDistance: z.number().min(0).max(1).optional(),
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
});

export const RepoSchema = z.object({
  ir_version: z.literal(IR_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  scannedAt: z.string().datetime(),
  languages: z.array(LanguageSchema).min(1),
  modules: z.array(ModuleSchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  scoreBreakdown: ScoreBreakdownSchema,
  grade: GradeSchema,
});
