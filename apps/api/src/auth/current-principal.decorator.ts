import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "./authenticated-principal";

type AuthenticatedRequest = Request & {
  readonly user?: AuthenticatedPrincipal;
};

/**
 * Injects the authenticated principal produced by the JWT strategy.
 *
 * Controllers receive the sanitized CasaStudio principal rather than raw JWT
 * claims, keeping token parsing and provider-specific details inside auth.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user as AuthenticatedPrincipal;
  }
);
