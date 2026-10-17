import {
  isFreeRoomBoundaryEdge,
  resolveFurnitureRoom,
  type FurnitureItem,
  type Point2D,
  type Project
} from "@casastudio/schema";
import {
  convexPolygonsOverlap,
  createFurnitureFootprint2D,
  createStairFootprints2D,
  createWallFootprints2D,
  polygonContainsPoint
} from "./plan-footprints.js";

/** Anchor-containing Room with global floor elevation for an explicit placement choice. */
export type FurnitureRoomCandidate = {
  readonly roomId: string;
  readonly name: string;
  readonly floorElevation: number;
};

export type FurniturePlacementIssue =
  "NO_ROOM" | "AMBIGUOUS_ROOM" | "WALL_INTERSECTION" | "FURNITURE_INTERSECTION";

export type FurniturePlacementWarning = "STAIRCASE_OVERLAP";

/** Ordered spatial-policy result shared by placement and every editing path. */
export type FurniturePlacementValidation =
  | { readonly status: "INVALID"; readonly issue: FurniturePlacementIssue }
  | { readonly status: "WARNING"; readonly warning: FurniturePlacementWarning }
  | { readonly status: "VALID" };

/**
 * Resolves anchor containment, including polygon edges, from ordered canonical Room boundaries.
 * Only center containment establishes ownership; full-footprint collisions are checked separately.
 * All Room elevations on the active plan participate; overlaps require an explicit Room choice.
 */
export function furnitureRoomCandidates(
  project: Project,
  levelId: string,
  point: Point2D
): readonly FurnitureRoomCandidate[] {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return [];
  const level = project.building.levels.find((entry) => entry.id === levelId);
  if (!level) return [];
  return level.rooms.flatMap((room) => {
    const vertices = room.boundary.map((edge) => {
      if (isFreeRoomBoundaryEdge(edge)) return edge.start;
      const wall = level.walls.find((entry) => entry.id === edge.wallId);
      return edge.direction === "FORWARD" ? wall?.start : wall?.end;
    });
    if (vertices.length < 3 || vertices.some((vertex) => !vertex)) return [];
    if (!polygonContainsPoint(vertices as Point2D[], point)) return [];
    return [
      {
        roomId: room.id,
        name: room.name,
        floorElevation: level.elevation + (room.elevation ?? 0)
      }
    ];
  });
}

/**
 * Validates a real oriented footprint against Room ownership, Wall bodies, same-floor
 * Furniture, and non-blocking Stair plan occupancy in deterministic priority order.
 */
export function validateFurniturePlacement(
  project: Project,
  levelId: string,
  item: FurnitureItem,
  ignoreFurnitureId?: string
): FurniturePlacementValidation {
  const level = project.building.levels.find((entry) => entry.id === levelId);
  const candidates = furnitureRoomCandidates(project, levelId, item.position);
  const target = candidates.find(
    (candidate) => candidate.roomId === item.roomId
  );
  if (!target)
    return {
      status: "INVALID",
      issue: candidates.length > 1 ? "AMBIGUOUS_ROOM" : "NO_ROOM"
    };
  if (!level) return { status: "INVALID", issue: "NO_ROOM" };

  const footprint = createFurnitureFootprint2D(item);
  if (
    createWallFootprints2D(level).some((wall) =>
      convexPolygonsOverlap(footprint, wall)
    )
  )
    return { status: "INVALID", issue: "WALL_INTERSECTION" };

  const furnitureOverlap = project.building.furniture.some((other) => {
    if (other.id === ignoreFurnitureId) return false;
    const otherRoom = resolveFurnitureRoom(project, other);
    return (
      otherRoom !== undefined &&
      Math.abs(otherRoom.floorElevation - target.floorElevation) <= 1e-7 &&
      convexPolygonsOverlap(footprint, createFurnitureFootprint2D(other))
    );
  });
  if (furnitureOverlap)
    return { status: "INVALID", issue: "FURNITURE_INTERSECTION" };

  if (
    createStairFootprints2D(level).some((stair) =>
      convexPolygonsOverlap(footprint, stair)
    )
  )
    return { status: "WARNING", warning: "STAIRCASE_OVERLAP" };
  return { status: "VALID" };
}
