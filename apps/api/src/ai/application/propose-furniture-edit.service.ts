import {
  DesignGenerationError,
  FurnitureEditRequestSchema,
  deriveFurnitureEditContext,
  validateFurnitureEditResult,
  type FurnitureEditProvider,
  type FurnitureEditResponse
} from "@casastudio/ai";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger
} from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import { FURNITURE_EDIT_PROVIDER } from "../furniture-edit-provider.token";
import { AiProviderFailure } from "../ai-provider-failure";
import { toApiProblem } from "../api/ai-problem.mapper";

@Injectable()
export class ProposeFurnitureEditService {
  private readonly logger = new Logger(ProposeFurnitureEditService.name);
  constructor(
    @Inject(AuthorizedProjectLoader)
    private readonly loader: AuthorizedProjectLoader,
    @Inject(FURNITURE_EDIT_PROVIDER)
    private readonly provider: FurnitureEditProvider
  ) {}

  async propose(
    projectId: string,
    raw: unknown,
    principal: AuthenticatedPrincipal
  ): Promise<FurnitureEditResponse> {
    const parsed = FurnitureEditRequestSchema.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException("Invalid Furniture edit request.");
    // Authorization precedes context construction and every provider invocation.
    const { loadedProject } = await this.loader.load(projectId, principal);
    const project = loadedProject.project;
    let stage:
      "context_validation" | "provider_request" | "command_validation" =
      "context_validation";
    try {
      const context = deriveFurnitureEditContext(project, parsed.data);
      stage = "provider_request";
      const interpreted = await this.provider.interpretFurnitureEdit({
        instructions: parsed.data.instructions,
        context
      });
      stage = "command_validation";
      const result = validateFurnitureEditResult(project, context, interpreted);
      return { projectId, projectRevision: project.revision, result };
    } catch (error) {
      // Never pass the raw SDK error/cause to the logger: it can contain request
      // content, response headers or credentials. Pino supplies HTTP correlation.
      this.logger.warn(
        {
          operation: "furniture-edit",
          provider: this.provider.name,
          stage: error instanceof AiProviderFailure ? error.stage : stage,
          code:
            error instanceof DesignGenerationError
              ? error.code
              : "generation_failed",
          ...(error instanceof AiProviderFailure
            ? error.diagnostics
            : {
                errorClass:
                  error instanceof DesignGenerationError
                    ? "DesignGenerationError"
                    : "UnknownError",
                safeMessage:
                  stage === "command_validation"
                    ? "Furniture commands failed CasaStudio validation."
                    : stage === "context_validation"
                      ? "Furniture edit context validation failed."
                      : "Furniture interpretation failed at the provider boundary."
              })
        },
        "AI Furniture interpretation failed"
      );
      if (error instanceof DesignGenerationError)
        throw toApiProblem(error, "furniture-edit");
      throw toApiProblem(
        new DesignGenerationError(
          "generation_failed",
          "The Furniture edit provider failed."
        ),
        "furniture-edit"
      );
    }
  }
}
