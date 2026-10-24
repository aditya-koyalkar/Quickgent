export interface JwtAccessPayload {
  sub: string;
  email: string;
  username: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  sid: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    authProvider: string;
    avatarUrl?: string | null;
    createdAt: Date;
  };
  tokens: AuthTokens;
}
