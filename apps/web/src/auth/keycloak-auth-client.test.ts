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

  it("reports development-safe initialization diagnostics without adapter state", async () => {
    const failure = new Error("Failed to fetch");
    const keycloak = createKeycloakStub({
      init: vi.fn().mockRejectedValue(failure)
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = new KeycloakAuthClient(
      keycloak,
      "casastudio-api",
      "http://192.0.2.10:8080"
    );

    await expect(client.initialize()).rejects.toBe(failure);
    expect(consoleError).toHaveBeenCalledWith(
      "CasaStudio authentication initialization failed.",
      {
        cause: "Failed to fetch",
        keycloakOrigin: "http://192.0.2.10:8080"
      }
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("access-token");
    consoleError.mockRestore();
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

  it("accepts an HTTP Keycloak endpoint on a private-network host", () => {
    expect(
      readKeycloakAuthConfiguration({
        VITE_KEYCLOAK_BASE_URL: "http://192.0.2.10:8080",
        VITE_KEYCLOAK_REALM: "casastudio",
        VITE_KEYCLOAK_CLIENT_ID: "casastudio-web",
        VITE_KEYCLOAK_ROLE_CLIENT_ID: "casastudio-api"
      } as unknown as ImportMetaEnv).baseUrl
    ).toBe("http://192.0.2.10:8080");
  });

  it("rejects a non-HTTP Keycloak endpoint", () => {
    expect(() =>
      readKeycloakAuthConfiguration({
        VITE_KEYCLOAK_BASE_URL: "file:///tmp/keycloak",
        VITE_KEYCLOAK_REALM: "casastudio",
        VITE_KEYCLOAK_CLIENT_ID: "casastudio-web",
        VITE_KEYCLOAK_ROLE_CLIENT_ID: "casastudio-api"
      } as unknown as ImportMetaEnv)
    ).toThrow("VITE_KEYCLOAK_BASE_URL must use the http or https protocol");
  });
});
