import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy, type StrategyOptionsWithoutRequest } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";

import type { AppConfiguration } from "../config/app-configuration";
import type { AuthenticatedPrincipal } from "./authenticated-principal";
import { principalFromKeycloakClaims, type KeycloakJwtPayload } from "./keycloak-claims";

/**
 * Passport JWT strategy for Keycloak-issued OIDC bearer tokens.
 *
 * The strategy validates token signature through Keycloak JWKS, enforces issuer
 * and audience, rejects expired tokens, and maps only configured client roles
 * into the immutable CasaStudio principal contract.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly clientId: string;

  constructor(@Inject(ConfigService) configService: ConfigService<AppConfiguration, true>) {
    const keycloak = configService.get("keycloak", { infer: true });
    const strategyOptions: StrategyOptionsWithoutRequest = {
      algorithms: ["RS256"],
      audience: keycloak.audience,
      ignoreExpiration: false,
      issuer: keycloak.issuer,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        jwksRequestsPerMinute: 5,
        jwksUri: keycloak.jwksUri,
        rateLimit: true
      })
    };

    super(strategyOptions);

    this.clientId = keycloak.clientId;
  }

  /**
   * Converts already-verified JWT claims into the API principal.
   */
  validate(payload: KeycloakJwtPayload): AuthenticatedPrincipal {
    return principalFromKeycloakClaims(payload, this.clientId);
  }
}
