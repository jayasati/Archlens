import { z } from 'zod';

export const createRepositorySchema = z.object({
  provider: z.literal('github').optional().default('github'),
  owner: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  defaultBranch: z.string().min(1).max(120).optional().default('main'),
  private: z.boolean().optional().default(false),
  htmlUrl: z.string().url().optional(),
});

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;
