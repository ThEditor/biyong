import type { RegisterRequest, LoginRequest, AuthResponse, SessionUser } from '@biyong/schemas';

export type { RegisterRequest, LoginRequest, SessionUser, AuthResponse };

export interface AuthClient {
  register(req: RegisterRequest): Promise<AuthResponse>;
  login(req: LoginRequest): Promise<AuthResponse>;
  logout(token: string): Promise<void>;
  getCurrentUser(token: string): Promise<SessionUser | null>;
}
