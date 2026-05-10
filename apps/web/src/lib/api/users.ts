import type { UserDto } from '@archlens/shared-types';
import { apiFetch, serverApiFetch } from './client';

export function getMe(token: string | null): Promise<UserDto> {
  return apiFetch<UserDto>('/users/me', { token });
}

export function getMeServer(token: string): Promise<UserDto> {
  return serverApiFetch<UserDto>('/users/me', { token });
}
