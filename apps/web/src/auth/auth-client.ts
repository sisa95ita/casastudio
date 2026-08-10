/**
 * Authenticated user information that is safe for presentation in the frontend.
 */
export type AuthUser = {
  readonly subject: string;
  readonly username?: string;
  readonly email?: string;
  readonly roles: readonly string[];
};

/**
 * Authentication state exposed to CasaStudio React components.
 */
export type AuthState = {
  readonly initialized: boolean;
  readonly authenticated: boolean;
  readonly user?: AuthUser;
};

/**
 * Result produced when a browser authentication client finishes initialization.
 */
export type AuthSession = {
  readonly authenticated: boolean;
  readonly user?: AuthUser;
};

/**
 * Narrow browser authentication boundary used by the React authentication layer.
 *
 * Implementations own bearer and refresh tokens. Callers can request a current
 * access token but cannot inspect adapter-specific session state.
 */
export interface AuthClient {
  /** Initializes browser authentication without requiring an interactive login. */
  initialize(): Promise<AuthSession>;
  /** Starts an interactive browser login. */
  login(): Promise<void>;
  /** Ends the browser session and returns to the public application. */
  logout(): Promise<void>;
  /** Returns a current access token without exposing refresh-token state. */
  getAccessToken(): Promise<string | null>;
}
