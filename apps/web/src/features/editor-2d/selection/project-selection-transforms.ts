import {
  deleteFurniture,
  deleteOpening,
  deleteRoom,
  deleteStaircase,
  deleteWallAndCollapseRedundantTopology,
  dissolveRoom,
  isWallRoomBoundaryEdge,
  translatePlanEntities,
  ValidationErrorCode,
  type Level,
  type Project,
  type ProjectEditingResult
} from "@casastudio/schema";

import type { GeometryPresentationModel2D } from "../../geometry-2d/presentation/geometry-presentation-model-2d";
import type { GeometrySelection } from "../../geometry-2d/selection/geometry-selection-state";
import { validateFurniturePlacement } from "../tools/furniture/project-furniture-authoring";

/** Canonical semantic root used to validate one whole selection operation. */
export type ProjectSelectionRoot =
  | { readonly kind: "WALL"; readonly id: string }
  | {
      readonly kind: "OPENING";
      readonly id: string;
      readonly wallId: string;
      readonly openingType: "DOOR" | "WINDOW" | "OPENING";
    }
  | { readonly kind: "ROOM"; readonly id: string }
  | { readonly kind: "STAIRCASE"; readonly id: string }
  | {
      readonly kind: "FURNITURE";
      readonly id: string;
      readonly roomId: string;
    };

/** Whole-selection capability result with concise rejection feedback. */
export type ProjectSelectionCapability =
  | { readonly supported: true }
  | { readonly supported: false; readonly reason: string };

/** Shared operation capabilities surfaced by Properties and interaction routing. */
export type ProjectSelectionCapabilities = {
  readonly translate: ProjectSelectionCapability;
  readonly nudge: ProjectSelectionCapability;
  readonly duplicate: ProjectSelectionCapability;
  readonly delete: ProjectSelectionCapability;
  readonly rotate: ProjectSelectionCapability;
};

/** Resolves presentation identities and Stair children into unique canonical roots. */
export function resolveProjectSelectionRoots(
  project: Project,
  level: Level,
  geometry: GeometryPresentationModel2D,
  selection: readonly GeometrySelection[]
): readonly ProjectSelectionRoot[] {
  const roots: ProjectSelectionRoot[] = [];
  for (const selected of selection) {
    if (selected.kind === "WALL")
      roots.push({ kind: "WALL", id: selected.geometryId });
    else if (selected.kind === "BOUNDARY_EDGE") {
      const wallId = geometry.boundaryEdges.find(
        (edge) => edge.geometryId === selected.geometryId
      )?.sourceWallId;
      if (wallId) roots.push({ kind: "WALL", id: wallId });
    } else if (selected.kind === "POLYGON") {
      const roomId = geometry.polygons.find(
        (polygon) => polygon.geometryId === selected.geometryId
      )?.sourceRoomId;
      if (roomId) roots.push({ kind: "ROOM", id: roomId });
    } else if (
      selected.kind === "DOOR" ||
      selected.kind === "WINDOW" ||
      selected.kind === "OPENING"
    ) {
      const wall = level.walls.find((candidate) =>
        candidate.openings.some((opening) => opening.id === selected.geometryId)
      );
      const opening = wall?.openings.find(
        (candidate) => candidate.id === selected.geometryId
      );
      if (wall && opening)
        roots.push({
          kind: "OPENING",
          id: opening.id,
          wallId: wall.id,
          openingType: opening.type
        });
    } else if (selected.kind === "STAIRCASE") {
      if (
        level.staircases.some(
          (staircase) => staircase.id === selected.geometryId
        )
      )
        roots.push({ kind: "STAIRCASE", id: selected.geometryId });
    } else if (
      selected.kind === "STAIR_FLIGHT" ||
      selected.kind === "STAIR_LANDING"
    ) {
      const staircase = level.staircases.find(
        (candidate) =>
          candidate.flights.some(
            (flight) => flight.id === selected.geometryId
          ) ||
          candidate.landings.some(
            (landing) => landing.id === selected.geometryId
          )
      );
      if (staircase) roots.push({ kind: "STAIRCASE", id: staircase.id });
    } else if (selected.kind === "FURNITURE") {
      const item = project.building.furniture.find(
        (candidate) => candidate.id === selected.geometryId
      );
      if (item)
        roots.push({ kind: "FURNITURE", id: item.id, roomId: item.roomId });
    }
  }
  const wallIds = new Set(
    roots.filter((root) => root.kind === "WALL").map((root) => root.id)
  );
  const roomIds = new Set(
    roots.filter((root) => root.kind === "ROOM").map((root) => root.id)
  );
  const seen = new Set<string>();
  return roots.filter((root) => {
    if (root.kind === "OPENING" && wallIds.has(root.wallId)) return false;
    if (root.kind === "FURNITURE" && roomIds.has(root.roomId)) return false;
    const key = `${root.kind}:${root.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Computes conservative capabilities that apply to every canonical root. */
export function getProjectSelectionCapabilities(
  level: Level,
  roots: readonly ProjectSelectionRoot[]
): ProjectSelectionCapabilities {
  const empty = roots.length === 0;
  const hasWallBoundedRoom = roots.some(
    (root) =>
      root.kind === "ROOM" &&
      level.rooms
        .find((room) => room.id === root.id)
        ?.boundary.some(isWallRoomBoundaryEdge)
  );
  const hasUnclosedWallSet = !hasClosedSelectedWallTopology(level, roots);
  const translate = empty
    ? unsupported("Select at least one editable entity.")
    : hasWallBoundedRoom
      ? unsupported(
          "Wall-bounded Rooms move through their boundary Walls, not as free polygons."
        )
      : hasUnclosedWallSet
        ? unsupported(
            "The selected Walls share junctions with unselected Walls."
          )
        : supported;
  const multipleWallBoundedRooms =
    roots.length > 1 &&
    roots.some(
      (root) =>
        root.kind === "ROOM" &&
        level.rooms
          .find((room) => room.id === root.id)
          ?.boundary.every(isWallRoomBoundaryEdge)
    );
  const deleteCapability = empty
    ? unsupported("Select at least one editable entity.")
    : multipleWallBoundedRooms
      ? unsupported(
          "Multiple connected wall-bounded Rooms cannot be deleted deterministically."
        )
      : supported;
  const singleFurniture = roots.length === 1 && roots[0]?.kind === "FURNITURE";
  return {
    translate,
    nudge: translate,
    duplicate:
      roots.length === 1 && roots[0]?.kind === "FURNITURE"
        ? supported
        : unsupported(
            "Duplicate is available only for one Furniture item in this selection."
          ),
    delete: deleteCapability,
    rotate: singleFurniture
      ? supported
      : unsupported("Group rotation is not available for this selection.")
  };
}

/** Applies one atomic semantic translation and validates Furniture at destination. */
export function translateProjectSelection(
  project: Project,
  level: Level,
  roots: readonly ProjectSelectionRoot[],
  delta: { readonly x: number; readonly z: number }
): ProjectEditingResult {
  const capability = getProjectSelectionCapabilities(level, roots).translate;
  if (!capability.supported) return editingFailure(capability.reason);
  const result = translatePlanEntities(project, {
    levelId: level.id,
    delta,
    wallIds: ids(roots, "WALL"),
    openingIds: ids(roots, "OPENING"),
    roomIds: ids(roots, "ROOM"),
    staircaseIds: ids(roots, "STAIRCASE"),
    furnitureIds: ids(roots, "FURNITURE")
  });
  if (!result.ok) return result;

  const movedRoomIds = new Set(ids(roots, "ROOM"));
  const movedWallIds = new Set(ids(roots, "WALL"));
  const affectedRoomIds = new Set([
    ...movedRoomIds,
    ...level.rooms
      .filter((room) =>
        room.boundary.some(
          (edge) =>
            isWallRoomBoundaryEdge(edge) && movedWallIds.has(edge.wallId)
        )
      )
      .map((room) => room.id)
  ]);
  const movedFurnitureIds = new Set([
    ...ids(roots, "FURNITURE"),
    ...project.building.furniture
      .filter((item) => affectedRoomIds.has(item.roomId))
      .map((item) => item.id)
  ]);
  for (const furnitureId of movedFurnitureIds) {
    const item = result.project.building.furniture.find(
      (candidate) => candidate.id === furnitureId
    );
    if (!item)
      return editingFailure(
        `Furniture "${furnitureId}" could not be validated after translation.`
      );
    const validation = validateFurniturePlacement(
      result.project,
      level.id,
      item,
      item.id
    );
    if (validation.status === "INVALID")
      return editingFailure(
        `Furniture translation is invalid: ${validation.issue}.`
      );
  }
  return result;
}

/** Deletes normalized semantic roots on a candidate Project and returns once. */
export function deleteProjectSelection(
  project: Project,
  level: Level,
  roots: readonly ProjectSelectionRoot[]
): ProjectEditingResult {
  const capability = getProjectSelectionCapabilities(level, roots).delete;
  if (!capability.supported) return editingFailure(capability.reason);
  let candidate: ProjectEditingResult = { ok: true, project };
  const apply = (operation: (project: Project) => ProjectEditingResult) => {
    if (candidate.ok) candidate = operation(candidate.project);
  };
  for (const root of roots) {
    if (root.kind === "OPENING")
      apply((current) =>
        deleteOpening(current, {
          levelId: level.id,
          wallId: root.wallId,
          openingId: root.id
        })
      );
    else if (root.kind === "FURNITURE")
      apply((current) => deleteFurniture(current, { furnitureId: root.id }));
    else if (root.kind === "STAIRCASE")
      apply((current) =>
        deleteStaircase(current, {
          owningLevelId: level.id,
          staircaseId: root.id
        })
      );
    else if (root.kind === "ROOM") {
      const room = level.rooms.find(
        (candidateRoom) => candidateRoom.id === root.id
      );
      apply((current) =>
        room?.boundary.every(isWallRoomBoundaryEdge)
          ? dissolveRoom(current, { levelId: level.id, roomId: root.id })
          : deleteRoom(current, { levelId: level.id, roomId: root.id })
      );
    } else if (root.kind === "WALL")
      apply((current) =>
        deleteWallAndCollapseRedundantTopology(current, {
          levelId: level.id,
          wallId: root.id
        })
      );
    if (!candidate.ok) return candidate;
  }
  return candidate;
}

function hasClosedSelectedWallTopology(
  level: Level,
  roots: readonly ProjectSelectionRoot[]
): boolean {
  const selected = new Set(ids(roots, "WALL"));
  for (const wall of level.walls.filter((candidate) =>
    selected.has(candidate.id)
  )) {
    for (const point of [wall.start, wall.end]) {
      if (
        level.walls.some(
          (candidate) =>
            !selected.has(candidate.id) &&
            ((candidate.start.x === point.x && candidate.start.z === point.z) ||
              (candidate.end.x === point.x && candidate.end.z === point.z))
        )
      )
        return false;
    }
  }
  return true;
}

function ids<K extends ProjectSelectionRoot["kind"]>(
  roots: readonly ProjectSelectionRoot[],
  kind: K
): string[] {
  return roots
    .filter(
      (root): root is Extract<ProjectSelectionRoot, { kind: K }> =>
        root.kind === kind
    )
    .map((root) => root.id);
}

const supported = { supported: true } as const;
const unsupported = (reason: string): ProjectSelectionCapability => ({
  supported: false,
  reason
});
const editingFailure = (message: string): ProjectEditingResult => ({
  ok: false,
  errors: [
    {
      code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
      path: "selection",
      message
    }
  ]
});
