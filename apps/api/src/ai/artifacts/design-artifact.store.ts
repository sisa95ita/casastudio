import type { DesignArtifact } from "@casastudio/ai";

export const DESIGN_ARTIFACT_STORE = Symbol("DESIGN_ARTIFACT_STORE");

export type ArtifactMetadata = Readonly<{
  key: string;
  mimeType: DesignArtifact["mimeType"];
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
}>;

/** Provider-independent byte storage. Keys are opaque application identities. */
export interface DesignArtifactStore {
  put(artifact: DesignArtifact): Promise<ArtifactMetadata>;
  read(metadata: ArtifactMetadata): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
