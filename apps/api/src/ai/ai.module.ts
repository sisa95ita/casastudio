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

@Module({
  imports: [ProjectsModule],
  controllers: [DesignProposalsController],
  providers: [
    GenerateDesignProposalService,
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
          maxRetries: 1
        });
        return new OpenAIInteriorDesignProvider(
          {
            reasoningModel: configuration.openai.reasoningModel,
            imageModel: configuration.openai.imageModel
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
