import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Requires a valid Keycloak bearer token before a route handler runs.
 *
 * Public infrastructure routes, such as health checks, omit this guard; all
 * protected diagnostics and later business APIs opt in explicitly or through a
 * future controller-level policy.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
