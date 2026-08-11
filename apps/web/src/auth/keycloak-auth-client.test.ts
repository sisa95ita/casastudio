import type Keycloak from "keycloak-js";
import { describe, expect, it, vi } from "vitest";

import {
  KeycloakAuthClient,
  mapKeycloakTokenToUser,
  readKeycloakAuthConfiguration
} from "./keycloak-auth-client";

function createKeycloakStub(overrides: Partial<Keycloak> = {}): Keycloak {
  return {
    authenticated: true,
    token: "access-token",
    tokenParsed: {
      sub: "user-1",
      preferred_username: "demo",
      email: "demo@casastudio.local",
      resource_access: {
        "casastudio-api": { roles: ["casastudio-user"] }
      }
    },
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    updateToken: vi.fn().mockResolvedValue(false),
    clearToken: vi.fn(),
    ...overrides
  } as unknown as Keycloak;
}

describe("KeycloakAuthClient", () => {
  it("restores an existing SSO session with standard flow and SHA-256 PKCE", async () => {
    const keycloak = createKeycloakStub();
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await expect(client.initialize()).resolves.toEqual({
      authenticated: true,
      user: {
        subject: "user-1",
        username: "demo",
        email: "demo@casastudio.local",
        roles: ["casastudio-user"]
      }
    });
    expect(keycloak.init).toHaveBeenCalledWith({
      checkLoginIframe: false,
      flow: "standard",
      onLoad: "check-sso",
      pkceMethod: "S256",
      responseMode: "fragment"
    });
  });

  it("falls back to an anonymous session when check-sso finds no valid session", async () => {
    const keycloak = createKeycloakStub({
      authenticated: false,
      init: vi.fn().mockResolvedValue(false),
      token: undefined,
      tokenParsed: undefined
    });
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await expect(client.initialize()).resolves.toEqual({ authenticated: false });
    expect(keycloak.login).not.toHaveBeenCalled();
  });

  it("shares one restoration attempt across concurrent initialization callers", async () => {
    const keycloak = createKeycloakStub();
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await Promise.all([client.initialize(), client.initialize()]);

    expect(keycloak.init).toHaveBeenCalledOnce();
  });

  it("refreshes an expiring token before returning the in-memory access token", async () => {
    const keycloak = createKeycloakStub();
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await expect(client.getAccessToken()).resolves.toBe("access-token");
    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
  });

  it("returns the current token when refresh succeeds", async () => {
    const keycloak = createKeycloakStub({
      token: "refreshed-access-token",
      updateToken: vi.fn().mockResolvedValue(true)
    });
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await expect(client.getAccessToken()).resolves.toBe("refreshed-access-token");
    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
    expect(keycloak.clearToken).not.toHaveBeenCalled();
  });

  it("clears adapter token state when refresh fails", async () => {
    const keycloak = createKeycloakStub({
      updateToken: vi.fn().mockRejectedValue(new Error("session expired"))
    });
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await expect(client.getAccessToken()).resolves.toBeNull();
    expect(keycloak.clearToken).toHaveBeenCalledOnce();
  });

  it("reports token unavailable when an authenticated adapter has no access token", async () => {
    const keycloak = createKeycloakStub({ token: undefined });
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await expect(client.getAccessToken()).resolves.toBeNull();
    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
    expect(keycloak.clearToken).not.toHaveBeenCalled();
  });

  it("does not refresh when the adapter is no longer authenticated", async () => {
    const keycloak = createKeycloakStub({ authenticated: false });
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");

    await expect(client.getAccessToken()).resolves.toBeNull();
    expect(keycloak.updateToken).not.toHaveBeenCalled();
  });

  it("delegates login and logout with application redirect URLs", async () => {
    const keycloak = createKeycloakStub();
    const client = new KeycloakAuthClient(keycloak, "casastudio-api");
    window.history.replaceState({}, "", "/app?mode=test#selection");

    await client.login();
    await client.logout();

    expect(keycloak.login).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/app?mode=test#selection"
    });
    expect(keycloak.logout).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/"
    });
  });
});

describe("mapKeycloakTokenToUser", () => {
  it("maps identity claims and only roles from the configured resource client", () => {
    expect(
      mapKeycloakTokenToUser(
        {
          sub: "user-1",
          preferred_username: "demo",
          email: "demo@casastudio.local",
          realm_access: { roles: ["realm-admin"] },
          resource_access: {
            "casastudio-api": {
              roles: ["casastudio-user", "casastudio-admin"]
            },
            "another-client": { roles: ["unrelated-role"] }
          }
        },
        "casastudio-api"
      )
    ).toEqual({
      subject: "user-1",
      username: "demo",
      email: "demo@casastudio.local",
      roles: ["casastudio-user", "casastudio-admin"]
    });
  });
});

describe("readKeycloakAuthConfiguration", () => {
  it("validates and normalizes public Vite authentication variables", () => {
    expect(
      readKeycloakAuthConfiguration({
        VITE_KEYCLOAK_BASE_URL: "http://localhost:8080/",
        VITE_KEYCLOAK_REALM: "casastudio",
        VITE_KEYCLOAK_CLIENT_ID: "casastudio-web",
        VITE_KEYCLOAK_ROLE_CLIENT_ID: "casastudio-api"
      } as unknown as ImportMetaEnv)
    ).toEqual({
      baseUrl: "http://localhost:8080",
      realm: "casastudio",
      webClientId: "casastudio-web",
      roleClientId: "casastudio-api"
    });
  });

  it("rejects missing frontend authentication variables", () => {
    expect(() => readKeycloakAuthConfiguration({} as unknown as ImportMetaEnv)).toThrow(
      "VITE_KEYCLOAK_BASE_URL"
    );
  });
});
