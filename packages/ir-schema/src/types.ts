import type { z } from 'zod';
import type {
  ClassSchema,
  CycleSchema,
  EdgeKindSchema,
  EdgeSchema,
  FileSchema,
  FunctionSchema,
  GradeSchema,
  LanguageSchema,
  LocationSchema,
  MethodSchema,
  ModuleSchema,
  RepoSchema,
  ScoreBreakdownSchema,
  SeveritySchema,
  SmellSchema,
} from './schema.js';

export type Grade = z.infer<typeof GradeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type EdgeKind = z.infer<typeof EdgeKindSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Smell = z.infer<typeof SmellSchema>;
export type Method = z.infer<typeof MethodSchema>;
export type FunctionIR = z.infer<typeof FunctionSchema>;
export type ClassIR = z.infer<typeof ClassSchema>;
export type FileIR = z.infer<typeof FileSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Cycle = z.infer<typeof CycleSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
export type Repo = z.infer<typeof RepoSchema>;
