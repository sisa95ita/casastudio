import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { RolesGuard } from "./roles.guard";

/**
 * Authentication and authorization foundation for the API.
 *
 * Phase 1A validates Keycloak OIDC bearer tokens and client roles only; domain
 * authorization such as project ownership belongs to later business modules.
 */
@Module({
  controllers: [AuthController],
  imports: [PassportModule.register({ defaultStrategy: "jwt" })],
  providers: [JwtStrategy, RolesGuard]
})
export class AuthModule {}
