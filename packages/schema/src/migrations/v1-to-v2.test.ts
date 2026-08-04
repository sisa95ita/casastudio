import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ProjectSchema } from "../project/index.js";
import { MigrationErrorCode } from "./migration-error.js";
import { migrateV1ToV2 } from "./v1-to-v2.js";

const legacyProjectUrl = new URL("../../examples/project-v1-legacy-wallIds.json", import.meta.url);

const loadLegacyProject = (): Record<string, unknown> => JSON.parse(readFileSync(legacyProjectUrl, "utf8"));

const getGroundLevel = (project: Record<string, unknown>) => {
  const building = project.building as { levels: Record<string, unknown>[] };
  const level = building.levels[0];

  if (!level) {
    throw new Error("Legacy fixture is missing its ground level.");
  }

  return level;
};

const getFirstRoom = (project: Record<string, unknown>) => {
  const level = getGroundLevel(project) as { rooms: Record<string, unknown>[] };
  const room = level.rooms[0];

  if (!room) {
    throw new Error("Legacy fixture is missing its first room.");
  }

  return room;
};

describe("migrateV1ToV2", () => {
  it("updates only the schema representation fields needed for v2", () => {
    const input = loadLegacyProject();
    const result = migrateV1ToV2(input);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.project.schemaVersion).toBe("2.0.0");
      expect(result.project.revision).toBe(7);
      expect(result.project.createdAt).toBe("2026-07-18T10:00:00+02:00");
      expect(result.project.updatedAt).toBe("2026-07-19T12:30:00+02:00");
    }
  });

  it("does not mutate the input object or nested objects", () => {
    const input = loadLegacyProject();
    const before = structuredClone(input);
    const roomBefore = getFirstRoom(input);
    const wallBefore = ((getGroundLevel(input) as { walls: Record<string, unknown>[] }).walls)[0];
    const result = migrateV1ToV2(input);

    expect(result.ok).toBe(true);
    expect(input).toEqual(before);
    expect(getFirstRoom(input)).toBe(roomBefore);
    expect(((getGroundLevel(input) as { walls: Record<string, unknown>[] }).walls)[0]).toBe(wallBefore);

    if (result.ok) {
      expect(result.project).not.toBe(input);
      expect(result.project.building.levels[0]?.rooms[0]).not.toBe(roomBefore);
    }
  });

  it("removes room wallIds, emits boundary, and passes canonical ProjectSchema", () => {
    const result = migrateV1ToV2(loadLegacyProject());

    expect(result.ok).toBe(true);

    if (result.ok) {
      const room = result.project.building.levels[0]?.rooms[0];

      expect(room).toBeDefined();
      expect(room).not.toHaveProperty("wallIds");
      expect(room?.boundary).toEqual([
        { wallId: "ground-north-wall", direction: "FORWARD" },
        { wallId: "living-east-wall", direction: "FORWARD" },
        { wallId: "living-south-wall", direction: "FORWARD" },
        { wallId: "living-west-wall", direction: "FORWARD" }
      ]);
      expect(ProjectSchema.parse(result.project)).toEqual(result.project);
    }
  });

  it("rejects v1 boundary-only rooms", () => {
    const input = loadLegacyProject();
    const room = getFirstRoom(input);

    room.boundary = [];
    delete room.wallIds;

    const result = migrateV1ToV2(input);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(MigrationErrorCode.INVALID_LEGACY_SHAPE);
    }
  });

  it("rejects v1 rooms with neither wallIds nor boundary", () => {
    const input = loadLegacyProject();
    const room = getFirstRoom(input);

    delete room.wallIds;

    const result = migrateV1ToV2(input);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(MigrationErrorCode.INVALID_LEGACY_SHAPE);
    }
  });

  it("accepts both fields when their wall membership is consistent", () => {
    const input = loadLegacyProject();
    const room = getFirstRoom(input);

    room.boundary = [
      { wallId: "living-south-wall", direction: "FORWARD" },
      { wallId: "living-west-wall", direction: "FORWARD" },
      { wallId: "ground-north-wall", direction: "FORWARD" },
      { wallId: "living-east-wall", direction: "FORWARD" }
    ];

    const result = migrateV1ToV2(input);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.project.building.levels[0]?.rooms[0]?.boundary.map((edge) => edge.wallId)).toEqual([
        "ground-north-wall",
        "living-east-wall",
        "living-south-wall",
        "living-west-wall"
      ]);
    }
  });

  it("rejects both fields when their wall membership is inconsistent", () => {
    const input = loadLegacyProject();
    const room = getFirstRoom(input);

    room.boundary = [
      { wallId: "ground-north-wall", direction: "FORWARD" },
      { wallId: "living-east-wall", direction: "FORWARD" },
      { wallId: "living-south-wall", direction: "FORWARD" },
      { wallId: "missing-wall", direction: "FORWARD" }
    ];

    const result = migrateV1ToV2(input);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(MigrationErrorCode.INVALID_LEGACY_SHAPE);
    }
  });
});
