import { z } from "zod";

import { RoomBoundaryEdgeSchema } from "../physical-building";
import { ProjectSchema } from "../project";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "../project/schema-version";
import {
  LegacyRoomBoundaryMigrationFailureReason,
  MigrationErrorCode,
  type ProjectMigrationError
} from "./migration-error";
import { resolveLegacyRoomBoundary } from "./legacy-room-boundary-resolver";
import type { ProjectMigrationResult } from "./migrate-project";

type MutableRecord = Record<string, unknown>;

type LegacyWall = {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
};

const BoundaryArraySchema = z.array(RoomBoundaryEdgeSchema);

const isRecord = (input: unknown): input is MutableRecord =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const cloneInput = (input: unknown): unknown => structuredClone(input);

const invalidLegacyShape = (
  message: string,
  path?: string,
  sourceVersion = "1.0.0",
  roomId?: string,
  levelId?: string
): ProjectMigrationError => ({
  code: MigrationErrorCode.INVALID_LEGACY_SHAPE,
  message,
  path,
  sourceVersion,
  roomId,
  levelId,
  reason: LegacyRoomBoundaryMigrationFailureReason.INVALID_LEGACY_SHAPE
});

const getCanonicalValidationErrors = (input: unknown): readonly ProjectMigrationError[] => {
  const parsed = ProjectSchema.safeParse(input);

  if (parsed.success) {
    return [];
  }

  return parsed.error.issues.map((issue): ProjectMigrationError => {
    const path = issue.path.join(".");

    return {
      code: MigrationErrorCode.CANONICAL_VALIDATION_FAILED,
      message: issue.message,
      path: path.length > 0 ? path : undefined,
      sourceVersion: "1.0.0"
    };
  });
};

const getStringArray = (input: unknown): string[] | undefined =>
  Array.isArray(input) && input.every((item) => typeof item === "string") ? input : undefined;

const hasSameWallMembership = (wallIds: readonly string[], boundary: readonly { wallId: string }[]): boolean => {
  const wallIdSet = new Set(wallIds);
  const boundaryWallIdSet = new Set(boundary.map((edge) => edge.wallId));

  return (
    wallIdSet.size === wallIds.length &&
    boundaryWallIdSet.size === boundary.length &&
    wallIdSet.size === boundaryWallIdSet.size &&
    [...wallIdSet].every((wallId) => boundaryWallIdSet.has(wallId))
  );
};

const validateSuppliedBoundary = (
  boundary: unknown,
  wallIds: readonly string[],
  roomId: string,
  levelId: string,
  path: string
): ProjectMigrationError | undefined => {
  const parsedBoundary = BoundaryArraySchema.safeParse(boundary);

  if (!parsedBoundary.success) {
    return invalidLegacyShape(
      `Room "${roomId}" has a boundary field that is not structurally valid for migration.`,
      `${path}.boundary`,
      "1.0.0",
      roomId,
      levelId
    );
  }

  const hasValidBoundaryLength = parsedBoundary.data.length === 0 || parsedBoundary.data.length >= 3;
  const hasUniqueWallIds = new Set(parsedBoundary.data.map((edge) => edge.wallId)).size === parsedBoundary.data.length;

  if (!hasValidBoundaryLength || !hasUniqueWallIds || !hasSameWallMembership(wallIds, parsedBoundary.data)) {
    return invalidLegacyShape(
      `Room "${roomId}" has inconsistent legacy wallIds and boundary fields.`,
      path,
      "1.0.0",
      roomId,
      levelId
    );
  }

  return undefined;
};

const getAllWalls = (levels: readonly MutableRecord[]): (LegacyWall & { levelId: string })[] =>
  levels.flatMap((level) => {
    const levelId = typeof level.id === "string" ? level.id : "";
    const walls = Array.isArray(level.walls) ? level.walls : [];

    return walls.filter(isLegacyWall).map((wall) => ({ ...wall, levelId }));
  });

const isLegacyWall = (input: unknown): input is LegacyWall => {
  if (!isRecord(input) || typeof input.id !== "string") {
    return false;
  }

  return isPoint(input.start) && isPoint(input.end);
};

const isPoint = (input: unknown): input is { x: number; z: number } =>
  isRecord(input) && typeof input.x === "number" && typeof input.z === "number";

const parseCanonicalProject = (input: unknown): ProjectMigrationResult => {
  const parsed = ProjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      errors: getCanonicalValidationErrors(input)
    };
  }

  return {
    ok: true,
    project: parsed.data,
    sourceVersion: "1.0.0",
    targetVersion: CURRENT_PROJECT_SCHEMA_VERSION
  };
};

/**
 * Migrates a raw schema version `1.0.0` Project document to canonical `2.0.0`.
 *
 * The migration clones the source input, replaces legacy Room `wallIds` with
 * canonical ordered and oriented `boundary` entries, removes `wallIds`, and
 * leaves revision and timestamps unchanged. Expected legacy-shape and topology
 * failures are returned as migration errors.
 */
export const migrateV1ToV2 = (input: unknown): ProjectMigrationResult => {
  const clonedInput = cloneInput(input);

  if (!isRecord(clonedInput) || clonedInput.schemaVersion !== "1.0.0") {
    return {
      ok: false,
      errors: [invalidLegacyShape("Project input is not a legacy schemaVersion 1.0.0 object.")]
    };
  }

  const building = clonedInput.building;

  if (!isRecord(building) || !Array.isArray(building.levels)) {
    return {
      ok: false,
      errors: [invalidLegacyShape("Legacy project input is missing building.levels.", "building.levels")]
    };
  }

  const errors: ProjectMigrationError[] = [];
  const levels = building.levels.filter(isRecord);
  const allWalls = getAllWalls(levels);

  building.levels.forEach((level, levelIndex) => {
    if (!isRecord(level)) {
      errors.push(invalidLegacyShape(`Legacy level at index ${levelIndex} is not an object.`, `building.levels.${levelIndex}`));
      return;
    }

    const levelId = typeof level.id === "string" ? level.id : `building.levels.${levelIndex}`;

    if (!Array.isArray(level.rooms) || !Array.isArray(level.walls)) {
      errors.push(
        invalidLegacyShape(
          `Legacy level "${levelId}" must contain rooms and walls arrays.`,
          `building.levels.${levelIndex}`,
          "1.0.0",
          undefined,
          levelId
        )
      );
      return;
    }

    const walls = level.walls.filter(isLegacyWall);

    level.rooms.forEach((room, roomIndex) => {
      const roomPath = `building.levels.${levelIndex}.rooms.${roomIndex}`;

      if (!isRecord(room)) {
        errors.push(invalidLegacyShape(`Legacy room at ${roomPath} is not an object.`, roomPath, "1.0.0", undefined, levelId));
        return;
      }

      const roomId = typeof room.id === "string" ? room.id : roomPath;
      const hasWallIds = "wallIds" in room;
      const hasBoundary = "boundary" in room;

      if (!hasWallIds && hasBoundary) {
        errors.push(
          invalidLegacyShape(
            `Legacy room "${roomId}" uses boundary without wallIds.`,
            roomPath,
            "1.0.0",
            roomId,
            levelId
          )
        );
        return;
      }

      if (!hasWallIds) {
        errors.push(invalidLegacyShape(`Legacy room "${roomId}" is missing wallIds.`, roomPath, "1.0.0", roomId, levelId));
        return;
      }

      const wallIds = getStringArray(room.wallIds);

      if (!wallIds) {
        errors.push(
          invalidLegacyShape(`Legacy room "${roomId}" wallIds must be an array of strings.`, `${roomPath}.wallIds`, "1.0.0", roomId, levelId)
        );
        return;
      }

      if (hasBoundary) {
        const boundaryError = validateSuppliedBoundary(room.boundary, wallIds, roomId, levelId, roomPath);

        if (boundaryError) {
          errors.push(boundaryError);
          return;
        }
      }

      const boundaryResult = resolveLegacyRoomBoundary({
        roomId,
        levelId,
        wallIds,
        walls,
        allWalls,
        path: `${roomPath}.wallIds`
      });

      if (!boundaryResult.ok) {
        errors.push(...boundaryResult.errors);
        return;
      }

      delete room.wallIds;
      room.boundary = boundaryResult.boundary;
    });
  });

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  clonedInput.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;

  return parseCanonicalProject(clonedInput);
};
