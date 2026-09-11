import {
  createFurniture,
  createFurnitureItemFromDefinition,
  duplicateFurniture,
  isFreeRoomBoundaryEdge,
  moveFurniture,
  reassignFurniture,
  resizeFurniture,
  rotateFurniture,
  resolveBuiltinFurnitureDefinition,
  resolveFurnitureRoom,
  type FurnitureItem,
  type Point2D,
  type Project,
  type ProjectEditingResult
} from "@casastudio/schema";
import {
  convexPolygonsOverlap,
  createFurnitureFootprint2D,
  createStairFootprints2D,
  createWallFootprints2D,
  polygonContainsPoint
} from "../../../geometry-2d/presentation/plan-footprints-2d";
import type { PrecisionTranslationResult } from "../../../geometry-2d/precision/precision-assistance-2d";

/** Anchor-containing Room with global floor elevation for an explicit placement choice. */
export type FurnitureRoomCandidate = {
  readonly roomId: string;
  readonly name: string;
  readonly floorElevation: number;
};

/** Properties editable without replacing canonical identity or catalog definition. */
export type FurniturePropertyChanges = Partial<
  Pick<
    FurnitureItem,
    "position" | "width" | "depth" | "height" | "rotation" | "roomId"
  >
>;

/** Serializable authoring proposal; an empty roomId is transient and can never commit. */
export type FurnitureInteraction = {
  readonly kind: "furniture";
  readonly intent: "place" | "duplicate" | "move" | "rotate";
  readonly item: FurnitureItem;
  readonly sourceId?: string;
  readonly positioned: boolean;
  /** Spatial preview becomes visible only after the canvas supplies its first anchor. */
  readonly previewVisible?: boolean;
  readonly awaitingRoom?: boolean;
  /** Explicit placement target retained only while its Room contains the center. */
  readonly explicitRoomId?: string;
  /** Exact transient assistance shared by preview and gesture commit. */
  readonly precision?: PrecisionTranslationResult;
  readonly gesture?: {
    readonly pointerId: number;
    readonly start: Point2D;
    readonly original: FurnitureItem;
  };
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
 * Footprint containment and collisions are deliberately not authoring constraints. All Room
 * elevations on the active plan participate; vertical overlaps require an explicit Room choice.
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

/** Preserves an eligible target, auto-resolves one candidate, and never guesses among overlaps. */
export function resolveFurnitureTarget(
  candidates: readonly FurnitureRoomCandidate[],
  preferred?: string
): string {
  return candidates.some((candidate) => candidate.roomId === preferred)
    ? preferred!
    : candidates.length === 1
      ? candidates[0]!.roomId
      : "";
}

/** Copies canonical catalog defaults into a detached placement proposal. */
export function startFurniturePlacement(
  definitionId: string
): FurnitureInteraction | undefined {
  const definition = resolveBuiltinFurnitureDefinition(definitionId);
  if (!definition) return undefined;
  const item = createFurnitureItemFromDefinition(definition, {
    id: "furniture-preview",
    roomId: "pending-room",
    position: { x: 0, z: 0 }
  });
  return {
    kind: "furniture",
    intent: "place",
    item: { ...item, roomId: "" },
    positioned: false,
    previewVisible: false
  };
}

/** Updates only transient geometry and safely re-resolves ownership at the new center. */
export function positionFurniture(
  project: Project,
  levelId: string,
  interaction: FurnitureInteraction,
  position: Point2D
): FurnitureInteraction {
  const candidates = furnitureRoomCandidates(project, levelId, position);
  const placing =
    interaction.intent === "place" || interaction.intent === "duplicate";
  const explicitRoomId = candidates.some(
    (candidate) => candidate.roomId === interaction.explicitRoomId
  )
    ? interaction.explicitRoomId
    : undefined;
  const roomId = resolveFurnitureTarget(
    candidates,
    placing ? explicitRoomId : interaction.item.roomId
  );
  return {
    ...interaction,
    explicitRoomId,
    positioned: true,
    previewVisible: true,
    item: { ...interaction.item, position, roomId }
  };
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

/** Commits a validated placement, duplicate, or move through canonical operations. */
export function commitFurnitureInteraction(
  project: Project,
  levelId: string,
  interaction: FurnitureInteraction,
  newId: string
): ProjectEditingResult | undefined {
  const { item } = interaction;
  const ignoreFurnitureId =
    interaction.intent === "move" || interaction.intent === "rotate"
      ? interaction.sourceId
      : undefined;
  if (
    !interaction.positioned ||
    validateFurniturePlacement(project, levelId, item, ignoreFurnitureId)
      .status === "INVALID"
  )
    return undefined;
  if (interaction.intent === "rotate" && interaction.sourceId) {
    return rotateFurniture(project, {
      furnitureId: interaction.sourceId,
      rotation: item.rotation
    });
  }
  if (interaction.intent === "duplicate" && interaction.sourceId) {
    const duplicated = duplicateFurniture(project, {
      furnitureId: interaction.sourceId,
      newId,
      position: item.position,
      roomId: item.roomId
    });
    if (!duplicated.ok) return duplicated;
    const resized = resizeFurniture(duplicated.project, {
      furnitureId: newId,
      width: item.width,
      depth: item.depth,
      height: item.height
    });
    return resized.ok
      ? rotateFurniture(resized.project, {
          furnitureId: newId,
          rotation: item.rotation
        })
      : resized;
  }
  if (interaction.intent === "move" && interaction.sourceId) {
    const moved = moveFurniture(project, {
      furnitureId: interaction.sourceId,
      position: item.position
    });
    return moved.ok
      ? reassignFurniture(moved.project, {
          furnitureId: interaction.sourceId,
          roomId: item.roomId
        })
      : moved;
  }
  return interaction.intent === "place"
    ? createFurniture(project, { furniture: { ...item, id: newId } })
    : undefined;
}
