import type { DesignProposal } from "@casastudio/ai";
import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Get,
  Delete,
  Query,
  HttpCode,
  Header,
  StreamableFile,
  UseGuards,
  ValidationPipe
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
import { DesignProposalHistoryService } from "../application/design-proposal-history.service";
import { DesignProposalHistoryQueryDto } from "./design-proposal.dto";
import {
  DesignConversationQueryDto,
  RefineRoomDesignRequestDto
} from "./design-proposal.dto";
import { RefineDesignProposalService } from "../application/refine-design-proposal.service";

@ApiTags("ai-design")
@ApiBearerAuth("bearer")
@Controller({ path: "projects/:id/design-proposals", version: "1" })
@UseGuards(JwtAuthGuard)
export class DesignProposalsController {
  constructor(
    @Inject(GenerateDesignProposalService)
    private readonly service: GenerateDesignProposalService,
    @Inject(DesignProposalHistoryService)
    private readonly history: DesignProposalHistoryService,
    @Inject(RefineDesignProposalService)
    private readonly refinement: RefineDesignProposalService
  ) {}

  @Post(":proposalId/refinements")
  @ApiOperation({
    summary:
      "Edit one saved proposal with a new delta instruction and persist one child."
  })
  refine(
    @Param("id", ProjectIdPipe) projectId: string,
    @Param("proposalId") proposalId: string,
    @Body(
      new ValidationPipe({
        expectedType: RefineRoomDesignRequestDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    input: RefineRoomDesignRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    return this.refinement.refine(projectId, proposalId, input, principal);
  }

  @Get(":proposalId/conversation")
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({
    summary:
      "Load root and chronological design turns (20 per page); null for an ordinary root."
  })
  async conversation(
    @Param("id", ProjectIdPipe) projectId: string,
    @Param("proposalId") proposalId: string,
    @Query(
      new ValidationPipe({
        expectedType: DesignConversationQueryDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: DesignConversationQueryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    return {
      page: await this.refinement.conversation(
        projectId,
        proposalId,
        principal,
        query.afterTurn
      )
    };
  }

  @Post()
  @ApiOperation({ summary: "Generate and persist one Room design proposal." })
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

  @Get()
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({
    summary: "List Room design history, newest first (20 per page)."
  })
  list(
    @Param("id", ProjectIdPipe) projectId: string,
    @Query() query: DesignProposalHistoryQueryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    return this.history.list(
      projectId,
      query.levelId,
      query.roomId,
      principal,
      query.cursor
    );
  }

  @Get(":proposalId/artifact")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ summary: "Read an authorized saved design image." })
  async artifact(
    @Param("id", ProjectIdPipe) projectId: string,
    @Param("proposalId") proposalId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    const { bytes, metadata } = await this.history.artifact(
      projectId,
      proposalId,
      principal
    );
    return new StreamableFile(bytes, {
      type: metadata.mimeType,
      length: bytes.length,
      disposition: "inline"
    });
  }

  @Delete(":proposalId")
  @HttpCode(204)
  @ApiOperation({
    summary:
      "Delete a saved proposal without changing Project geometry or revision."
  })
  delete(
    @Param("id", ProjectIdPipe) projectId: string,
    @Param("proposalId") proposalId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ) {
    return this.history.delete(projectId, proposalId, principal);
  }
}
