import Keycloak, { type KeycloakTokenParsed } from "keycloak-js";

import type { AuthClient, AuthSession, AuthUser } from "./auth-client";

/** Minimum remaining token lifetime accepted by future API callers. */
const ACCESS_TOKEN_MINIMUM_VALIDITY_SECONDS = 30;

/**
 * Public Keycloak browser configuration supplied through Vite environment variables.
 */
export type KeycloakAuthConfiguration = {
  readonly baseUrl: string;
  readonly realm: string;
  readonly webClientId: string;
  readonly roleClientId: string;
};

/**
 * Reads and validates the public Keycloak settings embedded by Vite.
 */
export function readKeycloakAuthConfiguration(
  environment: ImportMetaEnv
): KeycloakAuthConfiguration {
  return {
    baseUrl: requiredUrl(environment.VITE_KEYCLOAK_BASE_URL, "VITE_KEYCLOAK_BASE_URL"),
    realm: requiredValue(environment.VITE_KEYCLOAK_REALM, "VITE_KEYCLOAK_REALM"),
    webClientId: requiredValue(
      environment.VITE_KEYCLOAK_CLIENT_ID,
      "VITE_KEYCLOAK_CLIENT_ID"
    ),
    roleClientId: requiredValue(
      environment.VITE_KEYCLOAK_ROLE_CLIENT_ID,
      "VITE_KEYCLOAK_ROLE_CLIENT_ID"
    )
  };
}

/**
 * Creates the production authentication boundary for the configured Keycloak realm.
 */
export function createKeycloakAuthClient(
  configuration: KeycloakAuthConfiguration
): AuthClient {
  return new KeycloakAuthClient(
    new Keycloak({
      url: configuration.baseUrl,
      realm: configuration.realm,
      clientId: configuration.webClientId
    }),
    configuration.roleClientId
  );
}

/**
 * Keycloak JavaScript adapter wrapper used by the CasaStudio authentication provider.
 */
export class KeycloakAuthClient implements AuthClient {
  private initialization?: Promise<AuthSession>;

  /**
   * Creates an authentication boundary over one in-memory Keycloak adapter.
   */
  constructor(
    private readonly keycloak: Keycloak,
    private readonly roleClientId: string
  ) {}

  /**
   * Initializes Authorization Code Flow with SHA-256 PKCE without forcing login.
   */
  initialize(): Promise<AuthSession> {
    this.initialization ??= this.initializeKeycloak();
    return this.initialization;
  }

  /**
   * Starts interactive login and returns to the current application URL.
   */
  async login(): Promise<void> {
    await this.keycloak.login({ redirectUri: window.location.href });
  }

  /**
   * Ends the Keycloak session and returns to the public application route.
   */
  async logout(): Promise<void> {
    await this.keycloak.logout({ redirectUri: new URL("/", window.location.origin).href });
  }

  /**
   * Refreshes an expiring access token in memory before returning it to a caller.
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.keycloak.authenticated) {
      return null;
    }

    try {
      await this.keycloak.updateToken(ACCESS_TOKEN_MINIMUM_VALIDITY_SECONDS);
      return this.keycloak.token ?? null;
    } catch {
      this.keycloak.clearToken();
      return null;
    }
  }

  /** Performs the single underlying adapter initialization. */
  private async initializeKeycloak(): Promise<AuthSession> {
    const authenticated = await this.keycloak.init({
      checkLoginIframe: false,
      flow: "standard",
      pkceMethod: "S256",
      responseMode: "fragment"
    });

    if (!authenticated) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: mapKeycloakTokenToUser(this.keycloak.tokenParsed, this.roleClientId)
    };
  }
}

/**
 * Maps Keycloak access-token identity claims and one client's roles into UI state.
 */
export function mapKeycloakTokenToUser(
  token: KeycloakTokenParsed | undefined,
  roleClientId: string
): AuthUser {
  if (!token || typeof token.sub !== "string" || token.sub.length === 0) {
    throw new Error("The authenticated Keycloak token does not contain a subject.");
  }

  const clientRoles = token.resource_access?.[roleClientId]?.roles;

  return {
    subject: token.sub,
    username: optionalString(token.preferred_username),
    email: optionalString(token.email),
    roles: Array.isArray(clientRoles)
      ? clientRoles.filter((role): role is string => typeof role === "string")
      : []
  };
}

/** Returns non-empty string claims and ignores malformed optional claims. */
function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Validates one required public frontend environment value. */
function requiredValue(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required frontend environment variable ${name}.`);
  }

  return value.trim();
}

/** Validates and normalizes one HTTP-based public frontend URL. */
function requiredUrl(value: unknown, name: string): string {
  const parsed = new URL(requiredValue(value, name));

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use the http or https protocol.`);
  }

  return parsed.href.replace(/\/$/, "");
}
