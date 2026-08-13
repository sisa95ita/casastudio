import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const realmConfigUrl = new URL("../../../../docker/keycloak/casastudio-realm.json", import.meta.url);
const expectedDemoSubject = "8d62f7e2-0c2a-4f2a-a9cf-7f62c2f4e8f7";

type RealmClient = {
  readonly clientId?: unknown;
  readonly publicClient?: unknown;
  readonly standardFlowEnabled?: unknown;
  readonly directAccessGrantsEnabled?: unknown;
  readonly protocolMappers?: readonly RealmProtocolMapper[];
  readonly redirectUris?: readonly unknown[];
  readonly webOrigins?: readonly unknown[];
};

type RealmProtocolMapper = {
  readonly name?: unknown;
  readonly protocol?: unknown;
  readonly protocolMapper?: unknown;
  readonly consentRequired?: unknown;
  readonly config?: Record<string, unknown>;
};

type RealmUser = {
  readonly id?: unknown;
  readonly username?: unknown;
  readonly clientRoles?: Record<string, readonly unknown[]>;
};

type RealmConfig = {
  readonly realm?: unknown;
  readonly loginTheme?: unknown;
  readonly clients?: readonly RealmClient[];
  readonly users?: readonly RealmUser[];
};

describe("Keycloak development realm configuration", () => {
  const realmConfig = parseRealmConfig();

  it("defines the CasaStudio realm and API audience mapper", () => {
    const apiClient = findClient(realmConfig, "casastudio-api");
    const audienceMapper = findMapper(apiClient, "casastudio-api-audience");

    expect(realmConfig.realm).toBe("casastudio");
    expect(realmConfig.loginTheme).toBe("casastudio");
    expect(apiClient).toMatchObject({
      clientId: "casastudio-api",
      publicClient: false,
      standardFlowEnabled: false,
      directAccessGrantsEnabled: false
    });
    expect(audienceMapper).toMatchObject({
      protocol: "openid-connect",
      protocolMapper: "oidc-audience-mapper",
      consentRequired: false,
      config: {
        "included.client.audience": "casastudio-api",
        "access.token.claim": "true",
        "id.token.claim": "false"
      }
    });
  });

  it("keeps the browser client audience mapper and standard authorization flow intact", () => {
    const webClient = findClient(realmConfig, "casastudio-web");
    const audienceMapper = findMapper(webClient, "casastudio-api-audience");

    expect(webClient).toMatchObject({
      clientId: "casastudio-web",
      publicClient: true,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false
    });
    expect(webClient.redirectUris).toEqual(
      expect.arrayContaining([
        "http://localhost:5173/*",
        "http://localhost:8081/*",
        "${CASASTUDIO_WEB_LAN_ORIGIN}/*",
        "https://oauth.pstmn.io/v1/browser-callback"
      ])
    );
    expect(webClient.webOrigins).toEqual(
      expect.arrayContaining([
        "http://localhost:5173",
        "http://localhost:8081",
        "${CASASTUDIO_WEB_LAN_ORIGIN}"
      ])
    );
    expect(audienceMapper).toMatchObject({
      protocolMapper: "oidc-audience-mapper",
      config: {
        "included.client.audience": "casastudio-api",
        "access.token.claim": "true",
        "id.token.claim": "false"
      }
    });
  });

  it("keeps the demo user stable and assigned to the API user role", () => {
    const demoUser = realmConfig.users?.find((user) => user.username === "demo");

    expect(demoUser).toMatchObject({
      id: expectedDemoSubject,
      username: "demo"
    });
    expect(demoUser?.clientRoles?.["casastudio-api"]).toEqual(expect.arrayContaining(["casastudio-user"]));
  });

  it("includes the inherited CasaStudio login theme and lightweight brand assets", () => {
    const themeRoot = new URL("../../../../docker/keycloak/themes/casastudio/login/", import.meta.url);

    expect(readFileSync(new URL("theme.properties", themeRoot), "utf8")).toContain(
      "parent=keycloak.v2"
    );
    expect(existsSync(new URL("resources/css/casastudio-login.css", themeRoot))).toBe(true);
    expect(existsSync(new URL("resources/img/casastudio-mark.svg", themeRoot))).toBe(true);
    expect(existsSync(new URL("messages/messages_en.properties", themeRoot))).toBe(true);
  });

  it("mounts the repository theme and keeps machine overrides out of Git", () => {
    const compose = readFileSync(new URL("../../../../compose.yml", import.meta.url), "utf8");
    const gitignore = readFileSync(new URL("../../../../.gitignore", import.meta.url), "utf8");

    expect(compose).toContain("./docker/keycloak/themes:/opt/keycloak/themes:ro");
    expect(compose).toContain("CASASTUDIO_WEB_LAN_ORIGIN");
    expect(compose).toContain("CASASTUDIO_KEYCLOAK_HOSTNAME");
    expect(gitignore.split(/\r?\n/)).toContain(".env.local");
  });
});

function parseRealmConfig(): RealmConfig {
  return JSON.parse(readFileSync(realmConfigUrl, "utf8")) as RealmConfig;
}

function findClient(realmConfig: RealmConfig, clientId: string): RealmClient {
  const client = realmConfig.clients?.find((candidate) => candidate.clientId === clientId);

  expect(client).toBeDefined();

  if (!client) {
    throw new Error(`Expected Keycloak realm to define client "${clientId}".`);
  }

  return client;
}

function findMapper(client: RealmClient, mapperName: string): RealmProtocolMapper {
  const mapper = client.protocolMappers?.find((candidate) => candidate.name === mapperName);

  expect(mapper).toBeDefined();

  if (!mapper) {
    throw new Error(`Expected Keycloak client "${String(client.clientId)}" to define mapper "${mapperName}".`);
  }

  return mapper;
}
