import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const collectionUrl = new URL("../../../../tools/postman/CasaStudio API.postman_collection.json", import.meta.url);
const environmentUrl = new URL("../../../../tools/postman/CasaStudio Local.postman_environment.json", import.meta.url);

type PostmanCollection = {
  readonly auth?: {
    readonly type?: unknown;
    readonly oauth2?: readonly PostmanKeyValue[];
  };
  readonly item?: readonly PostmanItem[];
};

type PostmanEnvironment = {
  readonly values?: readonly PostmanKeyValue[];
};

type PostmanKeyValue = {
  readonly key?: unknown;
  readonly value?: unknown;
};

type PostmanItem = {
  readonly name?: unknown;
  readonly item?: readonly PostmanItem[];
  readonly request?: {
    readonly method?: unknown;
    readonly auth?: {
      readonly type?: unknown;
    };
    readonly header?: readonly PostmanKeyValue[];
    readonly url?: {
      readonly raw?: unknown;
    };
  };
};

describe("Postman development artifacts", () => {
  const collection = parseJson<PostmanCollection>(collectionUrl);
  const environment = parseJson<PostmanEnvironment>(environmentUrl);

  it("uses collection-level OAuth 2.0 Authorization Code with PKCE", () => {
    const oauthConfig = keyValueRecord(collection.auth?.oauth2 ?? []);

    expect(collection.auth?.type).toBe("oauth2");
    expect(oauthConfig).toMatchObject({
      addTokenTo: "header",
      authUrl: "{{keycloakBaseUrl}}/realms/{{realm}}/protocol/openid-connect/auth",
      accessTokenUrl: "{{keycloakBaseUrl}}/realms/{{realm}}/protocol/openid-connect/token",
      clientId: "{{clientId}}",
      client_authentication: "none",
      grant_type: "authorization_code_with_pkce",
      challengeAlgorithm: "S256",
      scope: "openid",
      callbackUrl: "https://oauth.pstmn.io/v1/browser-callback"
    });
    expect(oauthConfig).not.toHaveProperty("username");
    expect(oauthConfig).not.toHaveProperty("password");
    expect(oauthConfig).not.toHaveProperty("clientSecret");
  });

  it("contains only non-secret local environment defaults", () => {
    expect(keyValueRecord(environment.values ?? [])).toEqual({
      apiBaseUrl: "http://localhost:3000",
      keycloakBaseUrl: "http://localhost:8080",
      realm: "casastudio",
      clientId: "casastudio-web",
      projectId: "demo-project"
    });
    expect((environment.values ?? []).map((entry) => entry.key)).not.toEqual(
      expect.arrayContaining(["accessToken", "refreshToken", "password", "clientSecret", "adminPassword"])
    );
  });

  it("defines lifecycle and read requests whose URLs resolve from environment variables", () => {
    const requests = flattenRequests(collection.item ?? []);

    expect(requests.map((request) => request.method)).toEqual([
      "GET",
      "GET",
      "GET",
      "POST",
      "GET",
      "PUT",
      "PUT",
      "GET",
      "GET",
      "GET"
    ]);
    expect(requests.map((request) => request.url)).toEqual([
      "{{apiBaseUrl}}/api/v1/health/live",
      "{{apiBaseUrl}}/api/v1/health/ready",
      "{{apiBaseUrl}}/api/v1/projects",
      "{{apiBaseUrl}}/api/v1/projects",
      "{{apiBaseUrl}}/api/v1/projects/{{projectId}}",
      "{{apiBaseUrl}}/api/v1/projects/{{projectId}}",
      "{{apiBaseUrl}}/api/v1/projects/{{projectId}}",
      "{{apiBaseUrl}}/api/v1/projects/unknown-project",
      "{{apiBaseUrl}}/api/v1/projects/{{projectId}}/geometry",
      "{{apiBaseUrl}}/api/v1/projects/unknown-project/geometry"
    ]);
    expect(requests.every((request) => request.authType === "inherit")).toBe(true);
    expect(requests.flatMap((request) => request.headers.map((header) => header.key))).not.toContain("Authorization");
  });
});

function parseJson<Value>(url: URL): Value {
  return JSON.parse(readFileSync(url, "utf8")) as Value;
}

function keyValueRecord(entries: readonly PostmanKeyValue[]): Record<string, unknown> {
  return Object.fromEntries(
    entries.flatMap((entry) =>
      typeof entry.key === "string" && typeof entry.value !== "undefined" ? [[entry.key, entry.value]] : []
    )
  );
}

function flattenRequests(items: readonly PostmanItem[]): {
  readonly authType: unknown;
  readonly headers: readonly PostmanKeyValue[];
  readonly method: unknown;
  readonly url: unknown;
}[] {
  return items.flatMap((item) => {
    if (item.item) {
      return flattenRequests(item.item);
    }

    return [
      {
        authType: item.request?.auth?.type,
        headers: item.request?.header ?? [],
        method: item.request?.method,
        url: item.request?.url?.raw
      }
    ];
  });
}
