import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { RolesGuard } from "./roles.guard";

/**
 * Authentication and authorization boundary for the API.
 *
 * The module validates Keycloak OIDC bearer tokens and client roles. Domain
 * authorization, such as project ownership, belongs to the business modules
 * that own those resources.
 */
@Module({
  controllers: [AuthController],
  imports: [PassportModule.register({ defaultStrategy: "jwt" })],
  providers: [JwtStrategy, RolesGuard]
})
export class AuthModule {}
