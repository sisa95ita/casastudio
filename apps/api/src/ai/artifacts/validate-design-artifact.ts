import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import type { DesignArtifact } from "@casastudio/ai";
import { DesignGenerationError } from "@casastudio/ai";

/** Bounded data-URL decoding and format/header validation, without content analysis. */
export function validateDesignArtifact(
  artifact: DesignArtifact,
  maxBytes: number
) {
  try {
    const formats = ["image/png", "image/jpeg", "image/webp"];
    const prefix = `data:${artifact.mimeType};base64,`;
    if (
      !formats.includes(artifact.mimeType) ||
      !artifact.uri.startsWith(prefix)
    )
      throw new Error();
    const base64 = artifact.uri.slice(prefix.length);
    if (
      !base64 ||
      base64.length > Math.ceil(maxBytes / 3) * 4 ||
      base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
    )
      throw new Error();
    const bytes = Buffer.from(base64, "base64");
    if (
      !bytes.length ||
      bytes.length > maxBytes ||
      bytes.toString("base64") !== base64
    )
      throw new Error();
    const { width, height } = imageDimensions(bytes, artifact.mimeType);
    if (
      !width ||
      !height ||
      width > 16384 ||
      height > 16384 ||
      width * height > 64_000_000 ||
      (artifact.width !== undefined && artifact.width !== width) ||
      (artifact.height !== undefined && artifact.height !== height)
    )
      throw new Error();
    return {
      bytes,
      mimeType: artifact.mimeType,
      width,
      height,
      byteSize: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  } catch {
    throw new DesignGenerationError(
      "invalid_provider_response",
      "The generated image artifact is invalid or exceeds the storage limit."
    );
  }
}

function imageDimensions(
  bytes: Buffer,
  mime: string
): { width: number; height: number } {
  if (mime === "image/png") {
    if (
      !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.toString("ascii", 12, 16) !== "IHDR"
    )
      throw new Error();
    let offset = 8;
    let hasData = false;
    const data: Buffer[] = [];
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const kind = bytes.toString("ascii", offset + 4, offset + 8);
      if (offset + length + 12 > bytes.length) throw new Error();
      if (
        crc32(bytes.subarray(offset + 4, offset + length + 8)) !==
        bytes.readUInt32BE(offset + length + 8)
      )
        throw new Error();
      if (kind === "IDAT" && length > 0) {
        hasData = true;
        data.push(bytes.subarray(offset + 8, offset + length + 8));
      }
      offset += length + 12;
      if (kind === "IEND") {
        if (!hasData || length !== 0 || offset !== bytes.length)
          throw new Error();
        const width = bytes.readUInt32BE(16),
          height = bytes.readUInt32BE(20);
        const channels = (
          { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>
        )[bytes[25]!];
        const depth = bytes[24]!;
        if (
          !channels ||
          ![1, 2, 4, 8, 16].includes(depth) ||
          !width ||
          !height ||
          width > 16384 ||
          height > 16384 ||
          width * height > 64_000_000 ||
          bytes[26] !== 0 ||
          bytes[27] !== 0 ||
          ![0, 1].includes(bytes[28]!)
        )
          throw new Error();
        const inflated = inflateSync(Buffer.concat(data), {
          maxOutputLength: 128_000_000
        });
        if (!inflated.length) throw new Error();
        if (bytes[28] === 0) {
          const stride = Math.ceil((width * channels * depth) / 8) + 1;
          if (inflated.length !== stride * height) throw new Error();
          for (let y = 0; y < height; ++y)
            if (inflated[y * stride]! > 4) throw new Error();
        }
        return { width, height };
      }
    }
    throw new Error();
  }
  if (mime === "image/jpeg") {
    if (
      bytes.readUInt16BE(0) !== 0xffd8 ||
      bytes.readUInt16BE(bytes.length - 2) !== 0xffd9
    )
      throw new Error();
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 0xff) throw new Error();
      while (bytes[offset] === 0xff) ++offset;
      const marker = bytes[offset++]!;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error();
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8) throw new Error();
        return {
          width: bytes.readUInt16BE(offset + 5),
          height: bytes.readUInt16BE(offset + 3)
        };
      }
      offset += length;
    }
    throw new Error();
  }
  if (
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    throw new Error();
  const kind = bytes.toString("ascii", 12, 16);
  if (bytes.readUInt32LE(16) + 20 > bytes.length) throw new Error();
  if (kind === "VP8X")
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1
    };
  if (kind === "VP8 " && bytes.toString("hex", 23, 26) === "9d012a")
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    };
  if (kind === "VP8L" && bytes[20] === 0x2f) {
    const packed = bytes.readUInt32LE(21);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1
    };
  }
  throw new Error();
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; ++i) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
