import { z } from 'zod';

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
