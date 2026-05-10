export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.ARCHLENS_API_URL ?? 'http://localhost:3001';

export const SERVER_API_BASE_URL =
  process.env.ARCHLENS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
