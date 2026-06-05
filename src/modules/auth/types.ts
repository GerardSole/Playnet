// Public user data returned after registration — no sensitive fields
export interface RegisteredUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Full user row including credential — used internally only, never exposed in responses
export interface UserWithPassword extends RegisteredUser {
  passwordHash: string | null;
}

// Shape sent to clients — no userId
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token TTL in seconds
}

// Returned by the service to the controller so it can log userId.
// The Fastify response schema for auth routes does NOT include userId,
// so fast-json-stringify strips it before the response reaches the client.
export interface AuthResultInternal extends AuthResponse {
  readonly userId: string;
}

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}
