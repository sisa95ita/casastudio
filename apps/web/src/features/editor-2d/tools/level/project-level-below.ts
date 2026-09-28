import { GeometryEngine } from "@casastudio/geometry";
import {
  ProjectSchema,
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectIdentifierUniqueness,
  validateProjectReferenceConsistency,
  type Level,
  type Project
} from "@casastudio/schema";

import { createWallIdentifier } from "../wall/project-wall-editing";

/** Finds the nearest Level whose canonical global elevation is below the active Level. */
export function findNearestLowerLevel(
  project: Pick<Project, "building">,
  activeLevelId: string | null | undefined
): Level | undefined {
  const activeLevel = project.building.levels.find(
    (level) => level.id === activeLevelId
  );
  if (!activeLevel) return undefined;

  return project.building.levels.reduce<Level | undefined>(
    (nearest, level) =>
      level.elevation < activeLevel.elevation &&
      (!nearest || level.elevation > nearest.elevation)
        ? level
        : nearest,
    undefined
  );
}

/** Returns whether copying a non-empty lower-Level Wall footprint is actionable. */
export function canCreateFromLevelBelow(
  project: Pick<Project, "building">,
  activeLevelId: string | null | undefined
): boolean {
  const activeLevel = project.building.levels.find(
    (level) => level.id === activeLevelId
  );
  const sourceLevel = findNearestLowerLevel(project, activeLevelId);
  return Boolean(
    activeLevel &&
    sourceLevel &&
    sourceLevel.walls.length > 0 &&
    activeLevel.walls.length === 0 &&
    activeLevel.rooms.length === 0
  );
}

export type CreateFromLevelBelowResult =
  | Readonly<{ ok: true; project: Project; sourceLevelId: string }>
  | Readonly<{
      ok: false;
      reason: "NO_LOWER_LEVEL" | "ACTIVE_LEVEL_POPULATED" | "INVALID_PROJECT";
    }>;

/**
 * Creates one fully validated candidate Project containing only copied Walls.
 * The caller commits the returned Project once, preserving one semantic history entry.
 */
export function createFromLevelBelow(
  project: Project,
  activeLevelId: string,
  createId: () => string = createWallIdentifier
): CreateFromLevelBelowResult {
  const activeLevel = project.building.levels.find(
    (level) => level.id === activeLevelId
  );
  const sourceLevel = findNearestLowerLevel(project, activeLevelId);
  if (!activeLevel || !sourceLevel) {
    return { ok: false, reason: "NO_LOWER_LEVEL" };
  }
  if (activeLevel.walls.length > 0 || activeLevel.rooms.length > 0) {
    return { ok: false, reason: "ACTIVE_LEVEL_POPULATED" };
  }

  const candidate: Project = structuredClone(project);
  const candidateLevel = candidate.building.levels.find(
    (level) => level.id === activeLevelId
  )!;
  candidateLevel.walls = sourceLevel.walls.map((wall) => ({
    id: createId(),
    start: { ...wall.start },
    end: { ...wall.end },
    height: wall.height,
    thickness: wall.thickness,
    roomIds: [],
    openings: []
  }));

  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: "INVALID_PROJECT" };

  const validations = [
    validateProjectIdentifierUniqueness(parsed.data),
    validateProjectCrossReferences(parsed.data),
    validateProjectReferenceConsistency(parsed.data),
    validateProjectGeometry(parsed.data)
  ];
  if (validations.some((validation) => !validation.valid)) {
    return { ok: false, reason: "INVALID_PROJECT" };
  }

  const geometry = GeometryEngine.build(parsed.data);
  if (!geometry.ok) return { ok: false, reason: "INVALID_PROJECT" };

  return {
    ok: true,
    project: parsed.data,
    sourceLevelId: sourceLevel.id
  };
}
