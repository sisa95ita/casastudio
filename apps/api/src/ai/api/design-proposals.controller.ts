import type { DesignProposal } from "@casastudio/ai";
import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse
} from "@nestjs/swagger";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ProblemDetailsDto } from "../../common/problem-details/problem-details.dto";
import { ProjectIdPipe } from "../../projects/api/project-id.pipe";
import { GenerateDesignProposalService } from "../application/generate-design-proposal.service";
import { GenerateRoomDesignRequestDto } from "./design-proposal.dto";

@ApiTags("ai-design")
@ApiBearerAuth("bearer")
@Controller({ path: "projects/:id/design-proposals", version: "1" })
@UseGuards(JwtAuthGuard)
export class DesignProposalsController {
  constructor(
    @Inject(GenerateDesignProposalService)
    private readonly service: GenerateDesignProposalService
  ) {}

  @Post()
  @ApiOperation({ summary: "Generate a transient Room design proposal." })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto })
  @ApiServiceUnavailableResponse({ type: ProblemDetailsDto })
  @ApiBadGatewayResponse({ type: ProblemDetailsDto })
  generate(
    @Param("id", ProjectIdPipe) projectId: string,
    @Body() request: GenerateRoomDesignRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): Promise<DesignProposal> {
    return this.service.generate(projectId, request, principal);
  }
}
