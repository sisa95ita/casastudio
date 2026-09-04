import { readFileSync } from "node:fs";

import { ProjectSchema } from "../project/index.js";
import { describe, expect, it } from "vitest";

import { MigrationErrorCode } from "./migration-error.js";
import { migrateV2ToV3 } from "./v2-to-v3.js";

const canonicalProjectUrl = new URL("../../examples/project.json", import.meta.url);

const loadV2Project = (): Record<string, unknown> => ({
  ...JSON.parse(readFileSync(canonicalProjectUrl, "utf8")) as Record<string, unknown>,
  schemaVersion: "2.0.0"
});

describe("migrateV2ToV3", () => {
  it("losslessly preserves ordered and oriented Wall-only Room boundaries", () => {
    const input = loadV2Project();
    const originalBuilding = structuredClone(input.building);
    const result = migrateV2ToV3(input);

    expect(result).toMatchObject({
      ok: true,
      sourceVersion: "2.0.0",
      targetVersion: "3.0.0"
    });
    expect(input.schemaVersion).toBe("2.0.0");
    expect(input.building).toEqual(originalBuilding);
    if (!result.ok) return;
    expect(result.project.building).toEqual(originalBuilding);
    expect(ProjectSchema.safeParse(result.project).success).toBe(true);
  });

  it("is deterministic", () => {
    const input = loadV2Project();

    expect(migrateV2ToV3(input)).toEqual(migrateV2ToV3(input));
  });

  it("returns structured failures for invalid source shape and invalid canonical data", () => {
    expect(migrateV2ToV3({ schemaVersion: "1.0.0" })).toMatchObject({
      ok: false,
      errors: [{ code: MigrationErrorCode.INVALID_LEGACY_SHAPE }]
    });
    expect(migrateV2ToV3({ ...loadV2Project(), name: "" })).toMatchObject({
      ok: false,
      errors: [{ code: MigrationErrorCode.CANONICAL_VALIDATION_FAILED }]
    });
  });
});
