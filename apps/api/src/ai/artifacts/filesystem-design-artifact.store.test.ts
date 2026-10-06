import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemDesignArtifactStore } from "./filesystem-design-artifact.store";
import {
  fixtureArtifact,
  jpegArtifact,
  webpArtifact
} from "../test/design-fixture";

describe("filesystem design artifacts", () => {
  let root: string;
  let store: FilesystemDesignArtifactStore;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "casastudio-artifact-test-"));
    store = new FilesystemDesignArtifactStore(join(root, "images"), 1024);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates its root, atomically stores concurrent distinct events, verifies integrity, and deletes idempotently", async () => {
    const records = await Promise.all(
      Array.from({ length: 8 }, () => store.put(fixtureArtifact))
    );
    expect(new Set(records.map((r) => r.key)).size).toBe(8);
    expect(await readdir(join(root, "images"))).toHaveLength(8);
    expect(await store.read(records[0]!)).toEqual(
      Buffer.from(fixtureArtifact.uri.split(",")[1]!, "base64")
    );
    await store.delete(records[0]!.key);
    await store.delete(records[0]!.key);
    await expect(store.read(records[0]!)).rejects.toThrow();
  });

  it.each(["../outside", "/etc/passwd", "abc/../../outside", "not-an-id", ""])(
    "rejects arbitrary paths %s for reads and deletes",
    async (key) => {
      const record = await store.put(fixtureArtifact);
      await expect(store.read({ ...record, key })).rejects.toThrow(
        "Invalid artifact identity"
      );
      await expect(store.delete(key)).rejects.toThrow(
        "Invalid artifact identity"
      );
    }
  );

  it.each([
    { uri: "data:image/png;base64," },
    { uri: "data:image/png;base64,!!!!" },
    { uri: "data:image/png;base64,YQ==" },
    { uri: "data:image/png;base64,YR==" },
    { uri: "https://provider.test/image.png" },
    { mimeType: "image/svg+xml" },
    { mimeType: "image/jpeg" },
    { width: 2 },
    { height: 0 }
  ])(
    "rejects malformed/unsupported artifacts before creating any file: %j",
    async (invalid) => {
      await expect(
        store.put({ ...fixtureArtifact, ...invalid } as never)
      ).rejects.toMatchObject({ code: "invalid_provider_response" });
      expect(await readdir(root)).toEqual([]);
    }
  );

  it("rejects oversized bytes before writing", async () => {
    const small = new FilesystemDesignArtifactStore(join(root, "images"), 10);
    await expect(small.put(fixtureArtifact)).rejects.toMatchObject({
      code: "invalid_provider_response"
    });
    expect(await readdir(root)).toEqual([]);
  });

  it("rejects corrupted PNG chunks before writing", async () => {
    const bytes = Buffer.from(fixtureArtifact.uri.split(",")[1]!, "base64");
    bytes[45] = bytes[45]! ^ 1;
    await expect(
      store.put({
        ...fixtureArtifact,
        uri: `data:image/png;base64,${bytes.toString("base64")}`
      })
    ).rejects.toMatchObject({ code: "invalid_provider_response" });
    expect(await readdir(root)).toEqual([]);
  });

  it.each([jpegArtifact, webpArtifact])(
    "stores supported %j bytes with measured dimensions",
    async (artifact) => {
      const record = await store.put(artifact);
      expect(record).toMatchObject({
        mimeType: artifact.mimeType,
        width: 1,
        height: 1
      });
      expect((await store.read(record)).toString("base64")).toBe(
        artifact.uri.split(",")[1]
      );
    }
  );

  it("validates a realistic multi-megabyte base64 payload without regex stack overflow", async () => {
    const bytes = noisyPng();
    expect(bytes.length).toBeGreaterThan(2_000_000);
    const boundedStore = new FilesystemDesignArtifactStore(
      join(root, "images"),
      5_000_000
    );
    const record = await boundedStore.put({
      kind: "image",
      mimeType: "image/png",
      width: 1024,
      height: 768,
      uri: `data:image/png;base64,${bytes.toString("base64")}`
    });
    expect(record.byteSize).toBe(bytes.length);
    expect((await boundedStore.read(record)).equals(bytes)).toBe(true);
  });

  it("rejects symlink reads and modified bytes, and unlink never follows the symlink", async () => {
    const record = await store.put(fixtureArtifact);
    const path = join(root, "images", record.key);
    await writeFile(path, Buffer.alloc(record.byteSize));
    await expect(store.read(record)).rejects.toThrow("integrity");
    const outside = join(root, "outside");
    await writeFile(outside, "retained");
    await store.delete(record.key);
    await symlink(outside, path);
    await expect(store.read(record)).rejects.toThrow();
    await store.delete(record.key);
    expect(await readdir(root)).toContain("outside");
  });
});

function noisyPng(): Buffer {
  const width = 1024,
    height = 768,
    stride = width * 3 + 1;
  const rows = Buffer.alloc(stride * height);
  let seed = 13;
  for (let i = 0; i < rows.length; ++i) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    rows[i] = i % stride === 0 ? 0 : seed & 255;
  }
  const chunk = (kind: string, payload: Buffer) => {
    const content = Buffer.concat([Buffer.from(kind), payload]);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; ++bit)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(payload.length + 12);
    result.writeUInt32BE(payload.length);
    content.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
