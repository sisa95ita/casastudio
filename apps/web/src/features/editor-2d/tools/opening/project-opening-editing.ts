import { projectPointOntoWall } from "@casastudio/geometry";
import {
  IdentifierSchema,
  createOpening,
  type Door,
  type Opening,
  type Project,
  type ProjectEditingResult,
  type WallOpening,
  type Wall,
  type Window
} from "@casastudio/schema";

import type { WorldPointXZ } from "../../../geometry-2d/viewport/viewport-transform-2d";

/** Project-unit defaults used by the Door and Window placement tools. */
export const newOpeningDefaults = Object.freeze({
  door: { width: 90, height: 210, elevation: 0 },
  window: { width: 120, height: 120, elevation: 90 },
  opening: { width: 120, height: 210, elevation: 0 }
});

/** Physical and orientation values consumed by a transient Opening preview. */
export type OpeningPlacementProperties = {
  readonly width: number;
  readonly height: number;
  readonly elevation: number;
  readonly hingeSide?: "START" | "END";
  readonly swingSide?: "LEFT" | "RIGHT";
};

/** Validated Wall-local proposal for one transient Opening placement. */
export type OpeningPlacementCandidate = {
  readonly wallId: string;
  readonly wallStateKey: string;
  readonly opening: Opening;
  readonly projectedPoint: WorldPointXZ;
  readonly valid: boolean;
};

/** World-space distance within which Wall targeting candidates are treated as tied. */
const openingPlacementDistanceTieEpsilon = 1e-7;

/** Creates a collision-resistant Opening identifier accepted by the schema. */
export function createOpeningIdentifier(
  randomUuid: () => string = () => crypto.randomUUID()
): string {
  return IdentifierSchema.parse(`opening-${randomUuid().toLowerCase()}`);
}

/** Resolves the nearest Wall and validates a centered parametric placement. */
export function resolveOpeningPlacementCandidate(
  project: Project,
  levelId: string,
  point: WorldPointXZ,
  type: "DOOR" | "WINDOW" | "OPENING",
  maxSegmentDistance: number,
  pendingProperties?: OpeningPlacementProperties
): OpeningPlacementCandidate | undefined {
  const level = project.building.levels.find((candidate) => candidate.id === levelId);
  if (!level) return undefined;
  const defaults: OpeningPlacementProperties = pendingProperties ?? (type === "DOOR"
    ? newOpeningDefaults.door
    : type === "WINDOW"
      ? newOpeningDefaults.window
      : newOpeningDefaults.opening);
  const projections = level.walls.flatMap((wall) => {
    const projection = projectPointOntoWall(point, wall);
    const wallLength = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    const distance = Math.hypot(
      point.x - projection.projected.x,
      point.z - projection.projected.z
    );
    return wallLength >= defaults.width && distance <= maxSegmentDistance
      ? [{ wall, wallLength, projection, distance }]
      : [];
  }).sort((first, second) => {
    const distanceDifference = first.distance - second.distance;
    return Math.abs(distanceDifference) <= openingPlacementDistanceTieEpsilon
      ? first.wall.id.localeCompare(second.wall.id)
      : distanceDifference;
  });
  const nearest = projections[0];
  if (!nearest) return undefined;
  const offsetFromStart = Math.max(0, Math.min(nearest.wallLength - defaults.width, nearest.projection.distanceAlongWall - defaults.width / 2));
  const opening = type === "DOOR"
    ? ({
        id: "opening-placement-preview",
        type,
        offsetFromStart,
        width: defaults.width,
        height: defaults.height,
        elevation: defaults.elevation,
        hingeSide: defaults.hingeSide ?? "START",
        swingSide: defaults.swingSide ?? "LEFT",
        connectedRoomIds: nearest.wall.roomIds.length > 0 ? [...nearest.wall.roomIds] : undefined
      } satisfies Door)
    : type === "WINDOW"
      ? ({ id: "opening-placement-preview", type, offsetFromStart, width: defaults.width, height: defaults.height, elevation: defaults.elevation } satisfies Window)
      : ({ id: "opening-placement-preview", type, offsetFromStart, width: defaults.width, height: defaults.height, elevation: defaults.elevation } satisfies WallOpening);
  const validation = createOpening(project, {
    levelId,
    wallId: nearest.wall.id,
    opening
  });
  return {
    wallId: nearest.wall.id,
    wallStateKey: createOpeningPlacementWallStateKey(nearest.wall),
    opening,
    projectedPoint: nearest.projection.projected,
    valid: validation.ok
  };
}

/** Commits exactly one still-current transient placement without retargeting its Wall. */
export function commitOpeningPlacementCandidate(
  project: Project,
  levelId: string,
  candidate: OpeningPlacementCandidate,
  openingId: string
): ProjectEditingResult | undefined {
  const level = project.building.levels.find((current) => current.id === levelId);
  const wall = level?.walls.find((current) => current.id === candidate.wallId);
  if (
    !candidate.valid ||
    !wall ||
    createOpeningPlacementWallStateKey(wall) !== candidate.wallStateKey
  ) return undefined;

  const opening = { ...candidate.opening, id: openingId } as Opening;
  return createOpening(project, {
    levelId,
    wallId: candidate.wallId,
    opening
  });
}

/** Produces the canonical Wall-state guard carried by a transient placement. */
function createOpeningPlacementWallStateKey(wall: Wall): string {
  return JSON.stringify({
    start: wall.start,
    end: wall.end,
    height: wall.height,
    thickness: wall.thickness,
    roomIds: wall.roomIds,
    openings: wall.openings
  });
}

/** Finds one Opening together with its canonical owning Wall. */
export function findProjectOpening(
  project: Project | null | undefined,
  levelId: string | null | undefined,
  openingId: string | undefined
) {
  const level = project?.building.levels.find((candidate) => candidate.id === levelId);
  if (!level || !openingId) return undefined;
  for (const wall of level.walls) {
    const opening = wall.openings.find((candidate) => candidate.id === openingId);
    if (opening) return { wall, opening };
  }
  return undefined;
}
