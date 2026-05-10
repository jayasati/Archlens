import { ZodError, type ZodIssue } from 'zod';
import { RepoSchema } from './schema.js';
import type { Repo } from './types.js';

export interface IRValidationIssue {
  path: string;
  message: string;
  code: string;
}

export class IRValidationError extends Error {
  readonly issues: IRValidationIssue[];

  constructor(zodError: ZodError) {
    const issues = zodError.issues.map(toIssue);
    const summary = issues
      .map((i) => `  - ${i.path || '<root>'}: ${i.message} (${i.code})`)
      .join('\n');
    super(`IR validation failed with ${issues.length} issue(s):\n${summary}`);
    this.name = 'IRValidationError';
    this.issues = issues;
  }
}

function toIssue(issue: ZodIssue): IRValidationIssue {
  return {
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  };
}

export function validateIR(input: unknown): Repo {
  const result = RepoSchema.safeParse(input);
  if (!result.success) {
    throw new IRValidationError(result.error);
  }
  return result.data;
}

export function isValidIR(input: unknown): input is Repo {
  return RepoSchema.safeParse(input).success;
}
