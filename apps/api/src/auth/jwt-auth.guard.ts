import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Requires a valid Keycloak bearer token before a route handler runs.
 *
 * Public infrastructure routes, such as health checks, omit this guard.
 * Protected controllers opt in explicitly or apply the guard at the controller
 * level.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
