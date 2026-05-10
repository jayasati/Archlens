import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    archlensAccessToken?: string;
    error?: string;
  }

  interface User {
    archlensAccessToken?: string;
    archlensRefreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    archlens?: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      error?: 'RefreshFailed';
    };
  }
}
