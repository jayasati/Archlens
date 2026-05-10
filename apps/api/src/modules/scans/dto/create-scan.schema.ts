import { z } from 'zod';

export const createScanSchema = z.object({
  repoId: z.string().uuid(),
  ref: z.string().min(1).max(255).optional(),
  cloneUrl: z.string().min(1).optional(),
});

export type CreateScanInput = z.infer<typeof createScanSchema>;

export const listScansQuerySchema = z.object({
  repoId: z.string().uuid().optional(),
});

export type ListScansQuery = z.infer<typeof listScansQuerySchema>;
