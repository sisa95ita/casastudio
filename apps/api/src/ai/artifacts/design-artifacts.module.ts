import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfiguration } from "../../config/app-configuration";
import { DESIGN_ARTIFACT_STORE } from "./design-artifact.store";
import { FilesystemDesignArtifactStore } from "./filesystem-design-artifact.store";

@Module({
  providers: [
    {
      provide: DESIGN_ARTIFACT_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) => {
        const options = config.get("ai", { infer: true }).artifacts;
        return new FilesystemDesignArtifactStore(
          options.directory,
          options.maxBytes
        );
      }
    }
  ],
  exports: [DESIGN_ARTIFACT_STORE]
})
export class DesignArtifactsModule {}
