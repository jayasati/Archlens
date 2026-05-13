import { z } from 'zod';

export const updateRepositorySchema = z
  .object({
    defaultBranch: z.string().min(1).max(120).optional(),
    private: z.boolean().optional(),
  })
  .refine((v) => v.defaultBranch !== undefined || v.private !== undefined, {
    message: 'At least one field must be provided',
  });

export type UpdateRepositoryInput = z.infer<typeof updateRepositorySchema>;
