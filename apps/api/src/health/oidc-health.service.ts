import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AppConfiguration } from "../config/app-configuration";

const keySetContentType = "application/json";

/**
 * Checks the configured Keycloak OIDC/JWKS boundary used by JWT validation.
 *
 * This service does not authenticate to Keycloak or call admin APIs; it only
 * verifies that the public signing-key document required for bearer validation
 * is reachable and shaped like a JSON Web Key Set.
 */
@Injectable()
export class OidcHealthService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService<AppConfiguration, true>) {}

  /**
   * Verifies that issuer and JWKS configuration are syntactically valid and reachable.
   */
  async verifyReady(): Promise<void> {
    const keycloak = this.configService.get("keycloak", { infer: true });

    new URL(keycloak.issuer);
    new URL(keycloak.jwksUri);

    const response = await fetch(keycloak.jwksUri, {
      headers: {
        accept: keySetContentType
      },
      signal: AbortSignal.timeout(3_000)
    });

    if (!response.ok) {
      throw new Error(`JWKS endpoint returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as unknown;

    if (!isJsonWebKeySet(json)) {
      throw new Error("JWKS endpoint did not return a valid key set");
    }
  }
}

function isJsonWebKeySet(value: unknown): value is { readonly keys: readonly unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "keys" in value &&
    Array.isArray((value as { readonly keys?: unknown }).keys)
  );
}
