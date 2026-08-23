import { projectPointOntoWall } from "@casastudio/geometry";
import {
  IdentifierSchema,
  createDoor,
  createWindow,
  type Door,
  type Opening,
  type Project,
  type ProjectEditingResult,
  type Wall,
  type Window
} from "@casastudio/schema";

import type { WorldPointXZ } from "../geometry-playground/viewport-transform-2d";

/** Project-unit defaults used by the Door and Window placement tools. */
export const newOpeningDefaults = Object.freeze({
  door: { width: 90, height: 210, elevation: 0 },
  window: { width: 120, height: 120, elevation: 90 }
});

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
  type: "DOOR" | "WINDOW",
  maxSegmentDistance: number
): OpeningPlacementCandidate | undefined {
  const level = project.building.levels.find((candidate) => candidate.id === levelId);
  if (!level) return undefined;
  const defaults = type === "DOOR" ? newOpeningDefaults.door : newOpeningDefaults.window;
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
        ...defaults,
        hingeSide: "START",
        swingSide: "LEFT",
        connectedRoomIds: nearest.wall.roomIds.length > 0 ? [...nearest.wall.roomIds] : undefined
      } satisfies Door)
    : ({ id: "opening-placement-preview", type, offsetFromStart, ...defaults } satisfies Window);
  const validation = type === "DOOR"
    ? createDoor(project, { levelId, wallId: nearest.wall.id, door: opening as Door })
    : createWindow(project, { levelId, wallId: nearest.wall.id, window: opening as Window });
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
  return opening.type === "DOOR"
    ? createDoor(project, { levelId, wallId: candidate.wallId, door: opening })
    : createWindow(project, { levelId, wallId: candidate.wallId, window: opening });
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
