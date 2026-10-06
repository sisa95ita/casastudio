import { constants } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { DesignArtifact } from "@casastudio/ai";
import type {
  ArtifactMetadata,
  DesignArtifactStore
} from "./design-artifact.store";
import { validateDesignArtifact } from "./validate-design-artifact";

export class FilesystemDesignArtifactStore implements DesignArtifactStore {
  private readonly root: string;
  constructor(
    directory: string,
    private readonly maxBytes: number
  ) {
    this.root = resolve(directory);
  }

  async put(artifact: DesignArtifact): Promise<ArtifactMetadata> {
    const { bytes, ...metadata } = validateDesignArtifact(
      artifact,
      this.maxBytes
    );
    const key = randomUUID();
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const temporary = join(this.root, `.${key}.tmp`);
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(bytes);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, this.path(key));
      return { key, ...metadata };
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async read(metadata: ArtifactMetadata): Promise<Buffer> {
    const file = await open(
      this.path(metadata.key),
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
    try {
      const stat = await file.stat();
      if (
        !stat.isFile() ||
        stat.size < 1 ||
        stat.size > this.maxBytes ||
        stat.size !== metadata.byteSize
      )
        throw new Error("Invalid stored artifact size");
      const bytes = await file.readFile();
      if (createHash("sha256").update(bytes).digest("hex") !== metadata.sha256)
        throw new Error("Artifact integrity check failed");
      return bytes;
    } finally {
      await file.close();
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private path(key: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        key
      )
    )
      throw new Error("Invalid artifact identity");
    return join(this.root, key);
  }
}
