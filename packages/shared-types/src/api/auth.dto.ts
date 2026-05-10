export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string | null;
  githubUsername: string | null;
}
