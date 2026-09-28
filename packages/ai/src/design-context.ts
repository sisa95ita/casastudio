import {
  isWallRoomBoundaryEdge,
  type Project,
  type Room,
  type Wall
} from "@casastudio/schema";

import type {
  DesignBoundarySegment,
  DesignContext,
  DesignPoint2D,
  DesignTarget
} from "./contracts.js";
import { DesignGenerationError } from "./failures.js";

/** Derives a Room-specific semantic snapshot without mutating the Project. */
export function deriveDesignContext(
  project: Project,
  target: DesignTarget
): DesignContext {
  if (target.kind !== "room" || target.projectId !== project.id) {
    throw new DesignGenerationError(
      "unsupported_target",
      "The requested design target is not supported by this Project."
    );
  }

  const level = project.building.levels.find(
    (candidate) => candidate.id === target.levelId
  );
  const room = level?.rooms.find((candidate) => candidate.id === target.roomId);
  if (!level || !room) {
    throw new DesignGenerationError(
      "unsupported_target",
      "The requested Room could not be found on the requested Level."
    );
  }

  const wallById = new Map(level.walls.map((wall) => [wall.id, wall]));
  const boundary = deriveBoundary(room, wallById);
  const boundaryWallIds = new Set(
    boundary.flatMap((segment) => (segment.wallId ? [segment.wallId] : []))
  );
  const walls = level.walls.filter(
    (wall) => boundaryWallIds.has(wall.id) || wall.roomIds.includes(room.id)
  );
  const roomElevation = room.elevation ?? 0;

  return Object.freeze({
    project: Object.freeze({
      id: project.id,
      name: project.name,
      revision: project.revision
    }),
    level: Object.freeze({
      id: level.id,
      name: level.name,
      elevation: level.elevation
    }),
    room: Object.freeze({
      id: room.id,
      name: room.name,
      type: room.type,
      ...(room.description ? { description: room.description } : {}),
      elevation: roomElevation,
      floorElevation: level.elevation + roomElevation,
      boundary: Object.freeze(boundary),
      ...deriveExtents(boundary)
    }),
    walls: Object.freeze(
      walls.map((wall) =>
        Object.freeze({
          id: wall.id,
          ...(wall.name ? { name: wall.name } : {}),
          start: Object.freeze({ ...wall.start }),
          end: Object.freeze({ ...wall.end }),
          height: wall.height,
          thickness: wall.thickness,
          openings: Object.freeze(
            wall.openings.map((opening) =>
              Object.freeze({
                id: opening.id,
                type: opening.type.toLowerCase() as
                  "door" | "window" | "opening",
                offsetFromWallStart: opening.offsetFromStart,
                width: opening.width,
                height: opening.height,
                sillElevation: opening.elevation,
                ...("connectedRoomIds" in opening && opening.connectedRoomIds
                  ? {
                      connectedRoomIds: Object.freeze([
                        ...opening.connectedRoomIds
                      ])
                    }
                  : {})
              })
            )
          )
        })
      )
    ),
    stairs: Object.freeze(
      project.building.levels
        .flatMap((ownerLevel) =>
          ownerLevel.staircases.map((stair) => ({
            ownerLevelId: ownerLevel.id,
            stair
          }))
        )
        .filter(
          ({ ownerLevelId, stair }) =>
            stair.fromRoomId === room.id ||
            stair.toRoomId === room.id ||
            (ownerLevelId === level.id &&
              (!stair.fromRoomId || !stair.toRoomId) &&
              (stair.fromLevelId === level.id || stair.toLevelId === level.id))
        )
        .map(({ ownerLevelId, stair }) =>
          Object.freeze({
            id: stair.id,
            ...(stair.name ? { name: stair.name } : {}),
            owningLevelId: ownerLevelId,
            fromLevelId: stair.fromLevelId,
            toLevelId: stair.toLevelId,
            ...(stair.fromRoomId ? { fromRoomId: stair.fromRoomId } : {}),
            ...(stair.toRoomId ? { toRoomId: stair.toRoomId } : {}),
            width: stair.width,
            flights: Object.freeze(
              stair.flights.map((flight) =>
                Object.freeze({
                  start: Object.freeze({ ...flight.start }),
                  end: Object.freeze({ ...flight.end }),
                  startElevation: flight.startElevation,
                  endElevation: flight.endElevation,
                  stepCount: flight.stepCount
                })
              )
            ),
            landings: Object.freeze(
              stair.landings.map((landing) =>
                Object.freeze({
                  position: Object.freeze({ ...landing.position }),
                  width: landing.width,
                  depth: landing.depth,
                  elevation: landing.elevation
                })
              )
            )
          })
        )
    ),
    furniture: Object.freeze(
      project.building.furniture
        .filter((item) => item.roomId === room.id)
        .map((item) =>
          Object.freeze({
            id: item.id,
            ...(item.name ? { name: item.name } : {}),
            definitionId: item.definitionId,
            position: Object.freeze({ ...item.position }),
            rotationDegrees: item.rotation,
            width: item.width,
            depth: item.depth,
            height: item.height
          })
        )
    ),
    units: Object.freeze({ ...project.units }),
    coordinateSystem: Object.freeze({
      handedness: "right-handed",
      horizontalAxes: "X/Z",
      elevationAxis: "+Y"
    })
  });
}

function deriveBoundary(
  room: Room,
  wallById: ReadonlyMap<string, Wall>
): DesignBoundarySegment[] {
  return room.boundary.map((edge) => {
    if (!isWallRoomBoundaryEdge(edge)) {
      return Object.freeze({
        kind: "free" as const,
        start: Object.freeze({ ...edge.start }),
        end: Object.freeze({ ...edge.end })
      });
    }
    const wall = wallById.get(edge.wallId);
    if (!wall) {
      throw new DesignGenerationError(
        "unsupported_target",
        "The selected Room has an invalid canonical Wall reference."
      );
    }
    return Object.freeze({
      kind: "wall" as const,
      wallId: wall.id,
      start: Object.freeze({
        ...(edge.direction === "FORWARD" ? wall.start : wall.end)
      }),
      end: Object.freeze({
        ...(edge.direction === "FORWARD" ? wall.end : wall.start)
      })
    });
  });
}

function deriveExtents(
  boundary: readonly DesignBoundarySegment[]
):
  | { readonly extents: NonNullable<DesignContext["room"]["extents"]> }
  | Record<string, never> {
  const points: DesignPoint2D[] = boundary.flatMap((edge) => [
    edge.start,
    edge.end
  ]);
  if (points.length === 0) return {};
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const maxX = Math.max(...xs);
  const maxZ = Math.max(...zs);
  return {
    extents: Object.freeze({
      minX,
      minZ,
      maxX,
      maxZ,
      width: maxX - minX,
      depth: maxZ - minZ
    })
  };
}
