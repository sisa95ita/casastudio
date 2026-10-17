import {
  Body,
  Controller,
  Header,
  Inject,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ProjectIdPipe } from "../../projects/api/project-id.pipe";
import { ProposeFurnitureEditService } from "../application/propose-furniture-edit.service";

@ApiTags("ai-furniture-edit")
@ApiBearerAuth("bearer")
@Controller({ path: "projects/:id/furniture-edit-proposals", version: "1" })
@UseGuards(JwtAuthGuard)
export class FurnitureEditsController {
  constructor(
    @Inject(ProposeFurnitureEditService)
    private readonly service: ProposeFurnitureEditService
  ) {}
  @Post()
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({
    summary:
      "Propose Furniture commands against a persisted revision without changing the Project."
  })
  propose(
    @Param("id", ProjectIdPipe) id: string,
    @Body() body: unknown,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    return this.service.propose(id, body, principal);
  }
}
