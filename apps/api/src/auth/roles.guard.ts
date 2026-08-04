import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "./authenticated-principal";
import type { KeycloakRole } from "./keycloak-role";
import { requiredRolesMetadataKey } from "./roles.decorator";

type AuthenticatedRequest = Request & {
  readonly user?: AuthenticatedPrincipal;
};

/**
 * Enforces route-level Keycloak client-role requirements.
 *
 * The guard assumes authentication has already populated `request.user`; it
 * denies access when the token is valid but lacks at least one required client
 * role for the CasaStudio API client.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<readonly KeycloakRole[]>(requiredRolesMetadataKey, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.user;

    if (!principal) {
      throw new ForbiddenException("Authenticated principal is missing.");
    }

    const assignedRoles = new Set(principal.roles);
    const hasAllRoles = requiredRoles.every((role) => assignedRoles.has(role));

    if (!hasAllRoles) {
      throw new ForbiddenException("Required role is missing.");
    }

    return true;
  }
}
