import { stairFlightPoint3D, type Staircase3D } from "../model/staircase-3d-model";
import type {
  ArchitecturalScene3DModel,
  Door3D,
  Floor3D,
  Level3D,
  LevelVisibility3D,
  ScenePoint3D,
  Wall3D,
  WallOpening3D,
  Window3D
} from "../model/architectural-scene-3d-model";

/** Architectural entity kinds that can be inspected through the 3D viewer. */
export type ArchitecturalSelectionKind3D =
  | "wall"
  | "door"
  | "window"
  | "wall-opening"
  | "room"
  | "staircase";

/** Stable identity shared by selection, hover, renderer hit targets, and Inspector state. */
export type ArchitecturalEntityIdentity3D = Readonly<{
  kind: ArchitecturalSelectionKind3D;
  id: string;
  levelId: string;
}>;

/** Pure selection metadata for one canonical architectural entity. */
export type ArchitecturalSelection3D = Readonly<{
  kind: ArchitecturalSelectionKind3D;
  id: string;
  levelId: string;
  levelName: string;
  wallId?: string;
  roomId?: string;
  wall?: Wall3D;
  door?: Door3D;
  window?: Window3D;
  wallOpening?: WallOpening3D;
  floor?: Floor3D;
  staircase?: Staircase3D;
}>;

/** Semantic world point used by deterministic browser interaction acceptance. */
export type ArchitecturalSelectionTarget3D = Readonly<{
  identity: ArchitecturalEntityIdentity3D;
  point: ScenePoint3D;
  part?: "slab" | "landing" | "floor-side";
}>;

/** Resolves a canonical entity identity exclusively from the immutable presentation model. */
export function resolveArchitecturalSelection3D(
  model: ArchitecturalScene3DModel,
  identity: ArchitecturalEntityIdentity3D
): ArchitecturalSelection3D | undefined {
  const level = model.levels.find((candidate) => candidate.id === identity.levelId);
  return level ? resolveSelectionInLevel3D(level, identity) : undefined;
}

/** Tests whether a resolved selection remains present in the current Level visibility set. */
export function isArchitecturalSelectionVisible3D(
  selection: ArchitecturalSelection3D | undefined,
  visibility: LevelVisibility3D,
  activeLevelId?: string
): boolean {
  return Boolean(selection) && (visibility === "all" || selection!.levelId === activeLevelId);
}

/** Creates the renderer-stable comparison key for a canonical entity identity. */
export function getArchitecturalEntityKey3D(
  identity: ArchitecturalEntityIdentity3D | undefined
): string {
  return identity ? `${identity.levelId}:${identity.kind}:${identity.id}` : "";
}

/** Collects representative semantic points without relying on Three object identity. */
export function collectArchitecturalSelectionTargets3D(
  levels: readonly Level3D[]
): readonly ArchitecturalSelectionTarget3D[] {
  return Object.freeze(levels.flatMap((level) => [
    ...level.walls.flatMap((wall) => {
      const section = wall.sections[0];
      const wallTargets: ArchitecturalSelectionTarget3D[] = section ? [{
        identity: Object.freeze({ kind: "wall", id: wall.id, levelId: level.id }),
        point: Object.freeze({
          x: wall.origin.x + wall.u.x * (section.start + section.end) / 2,
          y: wall.origin.y + (section.bottom + section.top) / 2,
          z: wall.origin.z + wall.u.z * (section.start + section.end) / 2
        })
      }] : [];
      return [
        ...wallTargets,
        ...wall.doors.map((door) => ({
          identity: Object.freeze({ kind: "door" as const, id: door.id, levelId: level.id }),
          point: door.leaf.center
        })),
        ...wall.windows.map((window) => ({
          identity: Object.freeze({ kind: "window" as const, id: window.id, levelId: level.id }),
          point: window.glazing.center
        })),
        ...wall.wallOpenings.map((opening) => ({
          identity: Object.freeze({
            kind: "wall-opening" as const,
            id: opening.id,
            levelId: level.id
          }),
          point: opening.frame.center
        }))
      ];
    }),
    ...level.staircases.flatMap((stair) => {
      const flight = stair.flights[0];
      const step = flight?.steps[Math.floor(flight.steps.length / 2)];
      if (!flight || !step) return [];
      const along = (step.startAlong + step.endAlong) / 2;
      const identity = Object.freeze({ kind: "staircase" as const, id: stair.id, levelId: level.id });
      return [
        { identity, point: stairFlightPoint3D(flight, along, 0, step.elevation) },
        { identity, part: "slab" as const, point: stairFlightPoint3D(flight, along, flight.width / 2,
          flight.start.y + flight.rise * along / flight.run - flight.slabVerticalDepth / 2) },
        ...stair.landings.map((landing) => ({ identity, part: "landing" as const,
          point: { x: landing.center.x + landing.forward.x * landing.depth * 0.4,
            y: landing.center.y, z: landing.center.z + landing.forward.z * landing.depth * 0.4 } }))
      ];
    }),
    ...level.floors.flatMap((floor) => {
      const triangle = floor.triangles[0];
      if (!triangle) return [];
      const points = triangle.map((index) => floor.contour[index]!);
      const identity = Object.freeze({ kind: "room" as const, id: floor.roomId, levelId: level.id });
      const first = floor.contour[0]!, second = floor.contour[1]!;
      return [{
        identity,
        point: Object.freeze({
          x: points.reduce((sum, point) => sum + point.x, 0) / 3,
          y: floor.y,
          z: points.reduce((sum, point) => sum + point.z, 0) / 3
        })
      }, {
        identity, part: "floor-side" as const,
        point: Object.freeze({ x: (first.x + second.x) / 2, y: (floor.y + floor.bottomY) / 2, z: (first.z + second.z) / 2 })
      }];
    })
  ]));
}

/** Resolves one identity within a single already-derived Level. */
function resolveSelectionInLevel3D(
  level: Level3D,
  identity: ArchitecturalEntityIdentity3D
): ArchitecturalSelection3D | undefined {
  if (identity.kind === "staircase") {
    const staircase = level.staircases.find((candidate) => candidate.id === identity.id);
    return staircase ? Object.freeze({ ...identity, levelName: level.name, staircase }) : undefined;
  }
  if (identity.kind === "room") {
    const floor = level.floors.find((candidate) => candidate.roomId === identity.id);
    return floor ? Object.freeze({
      kind: "room",
      id: floor.roomId,
      roomId: floor.roomId,
      levelId: level.id,
      levelName: level.name,
      floor
    }) : undefined;
  }

  for (const wall of level.walls) {
    if (identity.kind === "wall" && wall.id === identity.id) {
      return createWallOwnedSelection(level, wall, identity, { wall });
    }
    if (identity.kind === "door") {
      const door = wall.doors.find((candidate) => candidate.id === identity.id);
      if (door) return createWallOwnedSelection(level, wall, identity, { door });
    }
    if (identity.kind === "window") {
      const window = wall.windows.find((candidate) => candidate.id === identity.id);
      if (window) return createWallOwnedSelection(level, wall, identity, { window });
    }
    if (identity.kind === "wall-opening") {
      const wallOpening = wall.wallOpenings.find((candidate) => candidate.id === identity.id);
      if (wallOpening) {
        return createWallOwnedSelection(level, wall, identity, { wallOpening });
      }
    }
  }
  return undefined;
}

/** Freezes selection metadata for an entity owned by one canonical Wall. */
function createWallOwnedSelection(
  level: Level3D,
  wall: Wall3D,
  identity: ArchitecturalEntityIdentity3D,
  entity: Pick<ArchitecturalSelection3D, "wall" | "door" | "window" | "wallOpening">
): ArchitecturalSelection3D {
  return Object.freeze({
    kind: identity.kind,
    id: identity.id,
    levelId: level.id,
    levelName: level.name,
    wallId: wall.id,
    ...entity
  });
}
