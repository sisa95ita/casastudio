import type { InteriorDesignProvider } from "@casastudio/ai";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import type { AppConfiguration } from "../config/app-configuration";
import { ProjectsModule } from "../projects/projects.module";
import { DesignProposalsController } from "./api/design-proposals.controller";
import { GenerateDesignProposalService } from "./application/generate-design-proposal.service";
import { INTERIOR_DESIGN_PROVIDER } from "./interior-design-provider.token";
import { OpenAIInteriorDesignProvider } from "./openai/openai-interior-design.provider";
import { UnconfiguredInteriorDesignProvider } from "./unconfigured-interior-design.provider";
import { PersistenceModule } from "../persistence/persistence.module";
import { DesignArtifactsModule } from "./artifacts/design-artifacts.module";
import { PersistDesignProposalService } from "./application/persist-design-proposal.service";
import { DesignProposalHistoryService } from "./application/design-proposal-history.service";
import { PrismaDesignProposalsRepository } from "./persistence/prisma-design-proposal.repository";
import { DESIGN_PROPOSALS_REPOSITORY } from "./persistence/design-proposal.repository";
import { RefineDesignProposalService } from "./application/refine-design-proposal.service";

@Module({
  imports: [ProjectsModule, PersistenceModule, DesignArtifactsModule],
  controllers: [DesignProposalsController],
  providers: [
    GenerateDesignProposalService,
    RefineDesignProposalService,
    PersistDesignProposalService,
    DesignProposalHistoryService,
    PrismaDesignProposalsRepository,
    {
      provide: DESIGN_PROPOSALS_REPOSITORY,
      useExisting: PrismaDesignProposalsRepository
    },
    {
      provide: INTERIOR_DESIGN_PROVIDER,
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<AppConfiguration, true>
      ): InteriorDesignProvider => {
        const configuration = configService.get("ai", { infer: true });
        if (
          configuration.provider !== "openai" ||
          !configuration.openai.apiKey
        ) {
          return new UnconfiguredInteriorDesignProvider();
        }
        const client = new OpenAI({
          apiKey: configuration.openai.apiKey,
          timeout: 180_000,
          // A timeout can hide a completed paid edit. Let the user decide to retry.
          maxRetries: 0
        });
        return new OpenAIInteriorDesignProvider(
          {
            reasoningModel: configuration.openai.reasoningModel,
            imageModel: configuration.openai.imageModel,
            imageQuality: configuration.openai.imageQuality,
            imageSize: configuration.openai.imageSize,
            imageFormat: configuration.openai.imageFormat
          },
          {
            create: async (input) =>
              (await client.responses.create(
                input as never
              )) as unknown as import("./openai/openai-interior-design.provider").OpenAIResponseLike
          }
        );
      }
    }
  ]
})
export class AiModule {}
