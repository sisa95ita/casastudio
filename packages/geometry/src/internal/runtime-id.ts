import type { Level, Project, Room, Wall } from "@casastudio/schema";

/**
 * Creates deterministic runtime identifiers for derived geometry objects.
 *
 * The strategy is prefix-based and source-derived: entities with a direct
 * persisted source use that source identifier, while derived topology uses
 * deterministic composite keys such as source room plus boundary index.
 * Vertex IDs include level context and exact XZ coordinate keys.
 */
export const runtimeId = {
  model: (project: Project): string => `geometry-model:${project.id}:${project.revision}`,
  level: (level: Level): string => `level:${level.id}`,
  vertex: (level: Level, x: number, z: number): string => `vertex:${level.id}:${coordinateKey(x, z)}`,
  boundaryEdge: (wall: Wall): string => `boundary-edge:${wall.id}`,
  boundaryEdgeUse: (room: Room, boundaryIndex: number): string =>
    `boundary-edge-use:${room.id}:${boundaryIndex}`,
  outerLoop: (room: Room): string => `loop:${room.id}:outer`,
  polygon: (room: Room): string => `polygon:${room.id}`
} as const;

/**
 * Exact level-local coordinate key used for vertex deduplication.
 *
 * No tolerance, snapping, or coordinate normalization is applied.
 */
export const coordinateKey = (x: number, z: number): string => `${x}:${z}`;
