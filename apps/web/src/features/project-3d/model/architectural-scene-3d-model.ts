import { GeometryEngine } from "@casastudio/geometry";
import {
  convertPhysicalLength,
  getDoorHingeSide,
  getDoorSwingSide,
  type DoorHingeSide,
  type DoorSwingSide,
  type MetricLengthUnit,
  type Opening,
  type Project,
  type RoomType,
  type Wall
} from "@casastudio/schema";

import type { GeometrySnapshot } from "../../../core/api/api-types";

/** Plain immutable point in the renderer's meter-scaled XYZ coordinate space. */
export type ScenePoint3D = Readonly<{ x: number; y: number; z: number }>;

/** Plain immutable horizontal vector in the renderer's XZ plane. */
export type ScenePlanVector3D = Readonly<{ x: number; z: number }>;

/** Plain immutable direction in the renderer's XYZ coordinate space. */
export type SceneVector3D = Readonly<{ x: number; y: number; z: number }>;

/** Axis-aligned bounds expressed in Three world units. */
export type SceneBounds3D = Readonly<{
  min: ScenePoint3D;
  max: ScenePoint3D;
  center: ScenePoint3D;
  size: ScenePoint3D;
}>;

/** Horizontal bounds containing a Level's rendered architectural geometry. */
export type LevelBounds3D = Readonly<{
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}>;

/** Plain line segment retaining one canonical Wall's plan orientation. */
export type LevelReferenceSegment3D = Readonly<{
  start: ScenePlanVector3D;
  end: ScenePlanVector3D;
}>;

/** Architectural Opening rectangle expressed in its owning Wall's local frame. */
export type Opening3D = Readonly<{
  id: string;
  kind: Opening["type"];
  offsetFromStart: number;
  width: number;
  elevation: number;
  height: number;
}>;

/** World-space frame shared by every entity occupying one canonical Wall void. */
export type OpeningWorldFrame3D = Readonly<{
  center: ScenePoint3D;
  u: ScenePlanVector3D;
  n: ScenePlanVector3D;
  v: SceneVector3D;
  start: ScenePoint3D;
  end: ScenePoint3D;
  width: number;
  height: number;
  elevation: number;
  wallThickness: number;
}>;

/** Thin immutable rectangular panel positioned entirely in world coordinates. */
export type ArchitecturalPanel3D = Readonly<{
  center: ScenePoint3D;
  u: ScenePlanVector3D;
  n: ScenePlanVector3D;
  width: number;
  height: number;
  thickness: number;
}>;

/** Rectangular frame bar aligned with an Opening's Wall-local axes. */
export type WindowFrameBar3D = Readonly<{
  center: ScenePoint3D;
  width: number;
  height: number;
  depth: number;
}>;

/** Immutable architectural Door entity derived from canonical orientation semantics. */
export type Door3D = Readonly<{
  id: string;
  kind: "DOOR";
  wallId: string;
  frame: OpeningWorldFrame3D;
  hingeSide: DoorHingeSide;
  swingSide: DoorSwingSide;
  openAngleRadians: number;
  hinge: ScenePoint3D;
  leafEnd: ScenePoint3D;
  leaf: ArchitecturalPanel3D;
}>;

/** Immutable minimal Window assembly contained by one canonical Wall void. */
export type Window3D = Readonly<{
  id: string;
  kind: "WINDOW";
  wallId: string;
  frame: OpeningWorldFrame3D;
  frameBars: readonly WindowFrameBar3D[];
  glazing: ArchitecturalPanel3D;
}>;

/** Immutable semantic marker for an unadorned canonical Wall Opening. */
export type WallOpening3D = Readonly<{
  id: string;
  kind: "OPENING";
  wallId: string;
  frame: OpeningWorldFrame3D;
}>;

/** Remaining rectangular Wall solid expressed in Wall-local along/vertical axes. */
export type WallSection3D = Readonly<{
  start: number;
  end: number;
  bottom: number;
  top: number;
}>;

/** Stable meter-scaled local frame and solids derived from one canonical Wall. */
export type Wall3D = Readonly<{
  id: string;
  origin: ScenePoint3D;
  u: ScenePlanVector3D;
  n: ScenePlanVector3D;
  length: number;
  thickness: number;
  height: number;
  openings: readonly Opening3D[];
  sections: readonly WallSection3D[];
  doors: readonly Door3D[];
  windows: readonly Window3D[];
  wallOpenings: readonly WallOpening3D[];
}>;

/** One triangle indexing the canonical contour of an architectural Floor. */
export type FloorTriangle3D = readonly [number, number, number];

/** Horizontal architectural Floor derived from one explicit Room polygon. */
export type Floor3D = Readonly<{
  id: string;
  roomId: string;
  roomName?: string;
  roomType?: RoomType;
  area: number;
  y: number;
  contour: readonly ScenePlanVector3D[];
  triangles: readonly FloorTriangle3D[];
}>;

/** Immutable architectural geometry belonging to one authoritative Level. */
export type Level3D = Readonly<{
  id: string;
  name: string;
  elevation: number;
  y: number;
  bounds?: LevelBounds3D;
  segments: readonly LevelReferenceSegment3D[];
  walls: readonly Wall3D[];
  floors: readonly Floor3D[];
}>;

/** Backwards-compatible name for the architectural Level presentation contract. */
export type LevelReference3D = Level3D;

/** Pure renderer-neutral presentation model derived from an authoritative Project. */
export type ArchitecturalScene3DModel = Readonly<{
  sourceProjectId: string;
  worldLengthUnit: "m";
  levels: readonly Level3D[];
  bounds?: SceneBounds3D;
  hasArchitecturalGeometry: boolean;
}>;

/** Presentation-only visibility modes for architectural Levels. */
export type LevelVisibility3D = "all" | "active";

/** Orientation of one ordered closed Level reference network on the XZ plane. */
export type LevelReferenceOrientation3D =
  | "counter-clockwise"
  | "clockwise"
  | "degenerate"
  | "open";

/** Converts a physical length to the renderer's meter-scaled world units. */
export function toThreeLength(value: number, sourceUnit: MetricLengthUnit): number {
  return convertPhysicalLength(value, sourceUnit, "m");
}

/** Maps Project plan coordinates into Three XZ while preserving 2D screen parity. */
export function projectPlanPointToThree(
  point: Readonly<{ x: number; z: number }>,
  sourceUnit: MetricLengthUnit
): ScenePlanVector3D {
  const z = toThreeLength(point.z, sourceUnit);
  return Object.freeze({ x: toThreeLength(point.x, sourceUnit), z: z === 0 ? 0 : -z });
}

/** Maps a Project X/Z point and Level elevation into renderer XYZ coordinates. */
export function projectPointToThree(
  point: Readonly<{ x: number; z: number }>,
  elevation: number,
  sourceUnit: MetricLengthUnit
): ScenePoint3D {
  const planPoint = projectPlanPointToThree(point, sourceUnit);
  return Object.freeze({
    x: planPoint.x,
    y: toThreeLength(elevation, sourceUnit),
    z: planPoint.z
  });
}

/** Deterministic presentation angle used by every static architectural Door leaf. */
export const architecturalDoorOpenAngleRadians = Math.PI / 4;

/** Derives the shared world frame of one Wall-relative Opening. */
export function createOpeningWorldFrame3D(
  wall: Pick<Wall3D, "origin" | "u" | "n" | "thickness">,
  opening: Opening3D
): OpeningWorldFrame3D {
  const centerAlong = opening.offsetFromStart + opening.width / 2;
  const centerY = wall.origin.y + opening.elevation + opening.height / 2;
  const center = freezeScenePoint(
    wall.origin.x + wall.u.x * centerAlong,
    centerY,
    wall.origin.z + wall.u.z * centerAlong
  );
  const halfWidth = opening.width / 2;
  return Object.freeze({
    center,
    u: wall.u,
    n: wall.n,
    v: Object.freeze({ x: 0, y: 1, z: 0 }),
    start: freezeScenePoint(
      center.x - wall.u.x * halfWidth,
      centerY,
      center.z - wall.u.z * halfWidth
    ),
    end: freezeScenePoint(
      center.x + wall.u.x * halfWidth,
      centerY,
      center.z + wall.u.z * halfWidth
    ),
    width: opening.width,
    height: opening.height,
    elevation: opening.elevation,
    wallThickness: wall.thickness
  });
}

/** Derives a partially-open Door panel from canonical Wall-relative orientation. */
export function createDoor3D(
  wall: Pick<Wall3D, "id" | "origin" | "u" | "n" | "thickness">,
  opening: Opening3D,
  hingeSide: DoorHingeSide,
  swingSide: DoorSwingSide
): Door3D {
  const frame = createOpeningWorldFrame3D(wall, opening);
  const hinge = hingeSide === "START" ? frame.start : frame.end;
  const closedDirection = hingeSide === "START"
    ? frame.u
    : Object.freeze({ x: -frame.u.x, z: -frame.u.z });

  // Project-to-Three reflects the plan Z axis, so canonical 2D LEFT maps to -n.
  const swingDirection = swingSide === "LEFT"
    ? Object.freeze({ x: -frame.n.x, z: -frame.n.z })
    : frame.n;
  const cosine = Math.cos(architecturalDoorOpenAngleRadians);
  const sine = Math.sin(architecturalDoorOpenAngleRadians);
  const leafAxis = Object.freeze({
    x: closedDirection.x * cosine + swingDirection.x * sine,
    z: closedDirection.z * cosine + swingDirection.z * sine
  });
  const leafNormal = Object.freeze({ x: -leafAxis.z, z: leafAxis.x });
  const leafEnd = freezeScenePoint(
    hinge.x + leafAxis.x * opening.width,
    hinge.y,
    hinge.z + leafAxis.z * opening.width
  );
  const leafThickness = Math.min(0.04, wall.thickness * 0.25);
  const leaf = Object.freeze({
    center: freezeScenePoint(
      (hinge.x + leafEnd.x) / 2,
      frame.center.y,
      (hinge.z + leafEnd.z) / 2
    ),
    u: leafAxis,
    n: leafNormal,
    width: opening.width,
    height: opening.height,
    thickness: leafThickness
  });
  return Object.freeze({
    id: opening.id,
    kind: "DOOR",
    wallId: wall.id,
    frame,
    hingeSide,
    swingSide,
    openAngleRadians: architecturalDoorOpenAngleRadians,
    hinge,
    leafEnd,
    leaf
  });
}

/** Derives a restrained four-bar Window frame and centered glazing panel. */
export function createWindow3D(
  wall: Pick<Wall3D, "id" | "origin" | "u" | "n" | "thickness">,
  opening: Opening3D
): Window3D {
  const frame = createOpeningWorldFrame3D(wall, opening);
  const barThickness = Math.min(0.06, opening.width / 4, opening.height / 4);
  const frameDepth = Math.min(wall.thickness, Math.max(0.025, wall.thickness * 0.6));
  const horizontalWidth = opening.width - 2 * barThickness;
  const verticalHeight = opening.height;
  const sideOffset = opening.width / 2 - barThickness / 2;
  const verticalOffset = opening.height / 2 - barThickness / 2;
  const frameBars = Object.freeze([
    createWindowFrameBar(frame, -sideOffset, 0, barThickness, verticalHeight, frameDepth),
    createWindowFrameBar(frame, sideOffset, 0, barThickness, verticalHeight, frameDepth),
    createWindowFrameBar(frame, 0, -verticalOffset, horizontalWidth, barThickness, frameDepth),
    createWindowFrameBar(frame, 0, verticalOffset, horizontalWidth, barThickness, frameDepth)
  ]);
  const glazingThickness = Math.min(0.012, frameDepth / 4);
  return Object.freeze({
    id: opening.id,
    kind: "WINDOW",
    wallId: wall.id,
    frame,
    frameBars,
    glazing: Object.freeze({
      center: frame.center,
      u: frame.u,
      n: frame.n,
      width: horizontalWidth,
      height: opening.height - 2 * barThickness,
      thickness: glazingThickness
    })
  });
}

/** Derives the semantic world frame of a clean Wall passage without adornment. */
export function createWallOpening3D(
  wall: Pick<Wall3D, "id" | "origin" | "u" | "n" | "thickness">,
  opening: Opening3D
): WallOpening3D {
  return Object.freeze({
    id: opening.id,
    kind: "OPENING",
    wallId: wall.id,
    frame: createOpeningWorldFrame3D(wall, opening)
  });
}

/** Creates one immutable Window bar at a Wall-local horizontal and vertical offset. */
function createWindowFrameBar(
  frame: OpeningWorldFrame3D,
  alongOffset: number,
  verticalOffset: number,
  width: number,
  height: number,
  depth: number
): WindowFrameBar3D {
  return Object.freeze({
    center: freezeScenePoint(
      frame.center.x + frame.u.x * alongOffset,
      frame.center.y + verticalOffset,
      frame.center.z + frame.u.z * alongOffset
    ),
    width,
    height,
    depth
  });
}

/** Freezes one finite renderer-space point without introducing renderer objects. */
function freezeScenePoint(x: number, y: number, z: number): ScenePoint3D {
  return Object.freeze({ x, y, z });
}

/**
 * Derives the immutable architectural 3D model from canonical Project data.
 * A matching server Geometry snapshot may supply already-derived Room contours.
 */
export function createArchitecturalScene3DModel(
  project: Project,
  geometrySnapshot?: GeometrySnapshot
): ArchitecturalScene3DModel {
  const sourceUnit = project.units.length;
  const floorSources = collectFloorContourSources(project, geometrySnapshot);
  const levels = project.building.levels.map<Level3D>((level) => {
    const walls = level.walls.map((wall) => createWall3D(wall, level.elevation, sourceUnit));
    const segments = walls.map<LevelReferenceSegment3D>((wall) => Object.freeze({
      start: Object.freeze({ x: wall.origin.x, z: wall.origin.z }),
      end: Object.freeze({
        x: wall.origin.x + wall.u.x * wall.length,
        z: wall.origin.z + wall.u.z * wall.length
      })
    }));
    const floors = (floorSources.get(level.id) ?? []).map<Floor3D>((floorSource) => {
      const contour = floorSource.points.map((point) =>
        projectPlanPointToThree(point, floorSource.unit)
      );
      return Object.freeze({
        id: `floor:${floorSource.roomId}`,
        roomId: floorSource.roomId,
        roomName: floorSource.roomName,
        roomType: floorSource.roomType,
        area: Math.abs(signedContourArea(contour)),
        y: toThreeLength(floorSource.floorElevation, floorSource.unit),
        contour: Object.freeze(contour),
        triangles: triangulateFloorContour3D(contour)
      });
    });
    const bounds3D = collectArchitecturalBounds3D(walls, floors);
    return Object.freeze({
      id: level.id,
      name: level.name,
      elevation: level.elevation,
      y: toThreeLength(level.elevation, sourceUnit),
      bounds: bounds3D ? Object.freeze({
        minX: bounds3D.min.x,
        minZ: bounds3D.min.z,
        maxX: bounds3D.max.x,
        maxZ: bounds3D.max.z
      }) : undefined,
      segments: Object.freeze(segments),
      walls: Object.freeze(walls),
      floors: Object.freeze(floors)
    });
  });
  const bounds = collectSceneBounds3D(levels);
  return Object.freeze({
    sourceProjectId: project.id,
    worldLengthUnit: "m",
    levels: Object.freeze(levels),
    bounds,
    hasArchitecturalGeometry: bounds !== undefined
  });
}

/** Plain trusted Room contour supplied by a Geometry Engine runtime or snapshot. */
type FloorContourSource3D = Readonly<{
  roomId: string;
  roomName?: string;
  roomType?: RoomType;
  unit: MetricLengthUnit;
  floorElevation: number;
  points: readonly Readonly<{ x: number; z: number }>[];
}>;

/** Reuses trusted Geometry Engine Room topology instead of interpreting Room boundaries again. */
function collectFloorContourSources(
  project: Project,
  geometrySnapshot?: GeometrySnapshot
): ReadonlyMap<string, readonly FloorContourSource3D[]> {
  if (geometrySnapshot) {
    return new Map(geometrySnapshot.levels.map((level) => {
      const projectLevel = project.building.levels.find(
        (candidate) => candidate.id === level.sourceLevelId
      );
      const roomsById = new Map(projectLevel?.rooms.map((room) => [room.id, room]) ?? []);
      const loopsById = new Map(level.loops.map((loop) => [loop.id, loop]));
      const edgeUsesById = new Map(
        level.boundaryEdgeUses.map((edgeUse) => [edgeUse.id, edgeUse])
      );
      const contours = level.polygons.map<FloorContourSource3D>((polygon) => {
        const room = roomsById.get(polygon.sourceRoomId);
        const loop = loopsById.get(polygon.outerLoopId);
        if (!loop || loop.kind !== "OUTER") {
          throw new Error(`Room "${polygon.sourceRoomId}" has no valid outer Geometry loop.`);
        }
        const points = loop.boundaryEdgeUseIds.map((edgeUseId) => {
          const edgeUse = edgeUsesById.get(edgeUseId);
          if (!edgeUse || edgeUse.loopId !== loop.id) {
            throw new Error(`Room "${polygon.sourceRoomId}" has an invalid Geometry edge use.`);
          }
          return Object.freeze({ ...edgeUse.start });
        });
        return Object.freeze({
          roomId: polygon.sourceRoomId,
          roomName: room?.name,
          roomType: room?.type,
          unit: geometrySnapshot.units.length,
          floorElevation: polygon.floorElevation,
          points: Object.freeze(points)
        });
      });
      return [level.sourceLevelId, Object.freeze(contours)] as const;
    }));
  }

  const geometryResult = GeometryEngine.build(project);
  if (!geometryResult.ok) {
    const detail = geometryResult.errors
      .map((error) => `${error.code}: ${error.message}`)
      .join("; ");
    throw new Error(`Cannot derive architectural 3D Room geometry. ${detail}`);
  }
  return new Map(geometryResult.model.levels.map((level) => {
    const projectLevel = project.building.levels.find(
      (candidate) => candidate.id === level.sourceLevelId
    );
    const roomsById = new Map(projectLevel?.rooms.map((room) => [room.id, room]) ?? []);
    return [
      level.sourceLevelId,
      Object.freeze(level.polygons.map<FloorContourSource3D>((polygon) => {
        const room = roomsById.get(polygon.sourceRoomId);
        return Object.freeze({
          roomId: polygon.sourceRoomId,
          roomName: room?.name,
          roomType: room?.type,
          unit: project.units.length,
          floorElevation: polygon.floorElevation,
          points: Object.freeze(polygon.outerLoop.vertices.map((vertex) => Object.freeze({
            x: vertex.x,
            z: vertex.z
          })))
        });
      }))
    ] as const;
  }));
}

/** Derives one canonical Wall's meter-scaled local frame and remaining solids. */
export function createWall3D(
  wall: Wall,
  levelElevation: number,
  sourceUnit: MetricLengthUnit
): Wall3D {
  const origin = projectPointToThree(wall.start, levelElevation, sourceUnit);
  const end = projectPointToThree(wall.end, levelElevation, sourceUnit);
  const delta = { x: end.x - origin.x, z: end.z - origin.z };
  const length = Math.hypot(delta.x, delta.z);
  const thickness = toThreeLength(wall.thickness, sourceUnit);
  const height = toThreeLength(wall.height, sourceUnit);
  assertPositiveFinite(length, `Wall "${wall.id}" length`);
  assertPositiveFinite(thickness, `Wall "${wall.id}" thickness`);
  assertPositiveFinite(height, `Wall "${wall.id}" height`);
  const u = Object.freeze({ x: delta.x / length, z: delta.z / length });
  const normalX = -u.z;
  const n = Object.freeze({ x: normalX === 0 ? 0 : normalX, z: u.x });
  const openings = wall.openings.map<Opening3D>((opening) => Object.freeze({
    id: opening.id,
    kind: opening.type,
    offsetFromStart: toThreeLength(opening.offsetFromStart, sourceUnit),
    width: toThreeLength(opening.width, sourceUnit),
    elevation: toThreeLength(opening.elevation, sourceUnit),
    height: toThreeLength(opening.height, sourceUnit)
  }));
  const wallFrame = Object.freeze({ id: wall.id, origin, u, n, thickness });
  const doors: Door3D[] = [];
  const windows: Window3D[] = [];
  const wallOpenings: WallOpening3D[] = [];
  wall.openings.forEach((opening, index) => {
    const opening3D = openings[index]!;
    if (opening.type === "DOOR") {
      doors.push(createDoor3D(
        wallFrame,
        opening3D,
        getDoorHingeSide(opening),
        getDoorSwingSide(opening)
      ));
    } else if (opening.type === "WINDOW") {
      windows.push(createWindow3D(wallFrame, opening3D));
    } else {
      wallOpenings.push(createWallOpening3D(wallFrame, opening3D));
    }
  });
  return Object.freeze({
    id: wall.id,
    origin,
    u,
    n,
    length,
    thickness,
    height,
    openings: Object.freeze(openings),
    sections: decomposeWallSections3D(length, height, openings, wall.id),
    doors: Object.freeze(doors),
    windows: Object.freeze(windows),
    wallOpenings: Object.freeze(wallOpenings)
  });
}

/** Subtracts Wall-local Opening rectangles into deterministic rectangular solids. */
export function decomposeWallSections3D(
  wallLength: number,
  wallHeight: number,
  openings: readonly Opening3D[],
  wallId = "unknown"
): readonly WallSection3D[] {
  assertPositiveFinite(wallLength, `Wall "${wallId}" length`);
  assertPositiveFinite(wallHeight, `Wall "${wallId}" height`);
  for (const opening of openings) {
    assertPositiveFinite(opening.width, `Opening "${opening.id}" width`);
    assertPositiveFinite(opening.height, `Opening "${opening.id}" height`);
    const end = opening.offsetFromStart + opening.width;
    const top = opening.elevation + opening.height;
    if (!Number.isFinite(opening.offsetFromStart) || !Number.isFinite(opening.elevation) ||
      opening.offsetFromStart < 0 || end > wallLength || opening.elevation < 0 || top > wallHeight) {
      throw new Error(`Opening "${opening.id}" does not fit inside Wall "${wallId}".`);
    }
  }
  const breakpoints = [...new Set([
    0,
    wallLength,
    ...openings.flatMap((opening) => [
      opening.offsetFromStart,
      opening.offsetFromStart + opening.width
    ])
  ])].sort((left, right) => left - right);
  const sections: WallSection3D[] = [];
  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const start = breakpoints[index]!;
    const end = breakpoints[index + 1]!;
    if (end <= start) continue;
    const midpoint = (start + end) / 2;
    const blocked = openings
      .filter((opening) => midpoint >= opening.offsetFromStart &&
        midpoint <= opening.offsetFromStart + opening.width)
      .map((opening) => ({
        bottom: opening.elevation,
        top: opening.elevation + opening.height
      }))
      .sort((left, right) => left.bottom - right.bottom || left.top - right.top);
    let cursor = 0;
    for (const interval of blocked) {
      if (interval.bottom > cursor) {
        sections.push(Object.freeze({ start, end, bottom: cursor, top: interval.bottom }));
      }
      cursor = Math.max(cursor, interval.top);
    }
    if (cursor < wallHeight) {
      sections.push(Object.freeze({ start, end, bottom: cursor, top: wallHeight }));
    }
  }
  return Object.freeze(sections);
}

/** Triangulates a simple exact Room contour while retaining its canonical vertices. */
export function triangulateFloorContour3D(
  contour: readonly ScenePlanVector3D[]
): readonly FloorTriangle3D[] {
  if (contour.length < 3) throw new Error("A Floor contour must contain at least three vertices.");
  const area = signedContourArea(contour);
  if (!Number.isFinite(area) || Math.abs(area) <= Number.EPSILON) {
    throw new Error("A Floor contour must have finite non-zero area.");
  }
  const orientation = Math.sign(area);
  const remaining = contour.map((_point, index) => index);
  removeCollinearTriangulationVertices(contour, remaining);
  const triangles: FloorTriangle3D[] = [];
  let attempts = 0;
  while (remaining.length > 3) {
    let clipped = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const previous = remaining[(index - 1 + remaining.length) % remaining.length]!;
      const current = remaining[index]!;
      const next = remaining[(index + 1) % remaining.length]!;
      const corner = cross2D(contour[previous]!, contour[current]!, contour[next]!);
      if (orientation * corner <= 1e-12) continue;
      const containsVertex = remaining.some((candidate) =>
        candidate !== previous && candidate !== current && candidate !== next &&
        pointInTriangle(contour[candidate]!, contour[previous]!, contour[current]!, contour[next]!)
      );
      if (containsVertex) continue;
      triangles.push(Object.freeze([previous, current, next]));
      remaining.splice(index, 1);
      clipped = true;
      break;
    }
    attempts += 1;
    if (!clipped || attempts > contour.length * contour.length) {
      throw new Error("The Room contour could not be triangulated as a simple polygon.");
    }
  }
  if (remaining.length === 3) {
    triangles.push(Object.freeze([remaining[0]!, remaining[1]!, remaining[2]!]));
  }
  return Object.freeze(triangles);
}

/** Returns the architectural Levels currently visible without mutating the model. */
export function getVisibleLevelReferences3D(
  model: ArchitecturalScene3DModel,
  visibility: LevelVisibility3D,
  activeLevelId?: string
): readonly Level3D[] {
  if (visibility === "all") return model.levels;
  const activeLevel = model.levels.find((level) => level.id === activeLevelId);
  return activeLevel ? Object.freeze([activeLevel]) : Object.freeze([]);
}

/** Derives physical scene bounds for the currently visible architectural Levels. */
export function collectVisibleSceneBounds3D(
  model: ArchitecturalScene3DModel,
  visibility: LevelVisibility3D,
  activeLevelId?: string
): SceneBounds3D | undefined {
  return collectSceneBounds3D(getVisibleLevelReferences3D(model, visibility, activeLevelId));
}

/** Classifies an ordered closed reference network without creating Three objects. */
export function getLevelReferenceOrientation3D(level: Level3D): LevelReferenceOrientation3D {
  if (level.segments.length < 3) return "open";
  const closed = level.segments.every((segment, index) => {
    const next = level.segments[(index + 1) % level.segments.length]!;
    return segment.end.x === next.start.x && segment.end.z === next.start.z;
  });
  if (!closed) return "open";
  const doubledArea = level.segments.reduce(
    (value, segment) => value + segment.start.x * segment.end.z - segment.end.x * segment.start.z,
    0
  );
  if (doubledArea === 0) return "degenerate";
  return doubledArea > 0 ? "counter-clockwise" : "clockwise";
}

/** Combines visible architectural solids, entities, and Floor surfaces. */
function collectSceneBounds3D(levels: readonly Level3D[]): SceneBounds3D | undefined {
  return createBoundsFromPoints(levels.flatMap((level) => [
    ...collectWallBoundsPoints(level.walls),
    ...collectFloorBoundsPoints(level.floors)
  ]));
}

/** Collects bounds for one Level's actual architectural renderables. */
function collectArchitecturalBounds3D(
  walls: readonly Wall3D[],
  floors: readonly Floor3D[]
): SceneBounds3D | undefined {
  return createBoundsFromPoints([
    ...collectWallBoundsPoints(walls),
    ...collectFloorBoundsPoints(floors)
  ]);
}

/** Expands Floor contours into world points for physical bounds. */
function collectFloorBoundsPoints(floors: readonly Floor3D[]): ScenePoint3D[] {
  return floors.flatMap((floor) =>
    floor.contour.map((point) => ({ x: point.x, y: floor.y, z: point.z }))
  );
}

/** Expands Wall solids and entity corners into world points for exact rendered bounds. */
function collectWallBoundsPoints(walls: readonly Wall3D[]): ScenePoint3D[] {
  return walls.flatMap((wall) => [
    ...wall.sections.flatMap((section) => {
      const halfThickness = wall.thickness / 2;
      return [section.start, section.end].flatMap((along) =>
        [section.bottom, section.top].flatMap((vertical) =>
          [-halfThickness, halfThickness].map((normal) => ({
            x: wall.origin.x + wall.u.x * along + wall.n.x * normal,
            y: wall.origin.y + vertical,
            z: wall.origin.z + wall.u.z * along + wall.n.z * normal
          }))
        )
      );
    }),
    ...wall.doors.flatMap((door) => collectPanelBoundsPoints(door.leaf)),
    ...wall.windows.flatMap((window) => [
      ...window.frameBars.flatMap((bar) => collectPanelBoundsPoints({
        center: bar.center,
        u: window.frame.u,
        n: window.frame.n,
        width: bar.width,
        height: bar.height,
        thickness: bar.depth
      })),
      ...collectPanelBoundsPoints(window.glazing)
    ])
  ]);
}

/** Expands a world-space architectural panel into its eight physical corners. */
function collectPanelBoundsPoints(panel: ArchitecturalPanel3D): ScenePoint3D[] {
  return [-panel.width / 2, panel.width / 2].flatMap((along) =>
    [-panel.height / 2, panel.height / 2].flatMap((vertical) =>
      [-panel.thickness / 2, panel.thickness / 2].map((normal) => ({
        x: panel.center.x + panel.u.x * along + panel.n.x * normal,
        y: panel.center.y + vertical,
        z: panel.center.z + panel.u.z * along + panel.n.z * normal
      }))
    )
  );
}

/** Creates immutable axis-aligned bounds for a finite non-empty point set. */
function createBoundsFromPoints(points: readonly ScenePoint3D[]): SceneBounds3D | undefined {
  if (points.length === 0) return undefined;
  if (points.some((point) =>
    !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)
  )) throw new Error("Architectural 3D bounds contain a non-finite point.");
  const min = Object.freeze({
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
    z: Math.min(...points.map((point) => point.z))
  });
  const max = Object.freeze({
    x: Math.max(...points.map((point) => point.x)),
    y: Math.max(...points.map((point) => point.y)),
    z: Math.max(...points.map((point) => point.z))
  });
  return Object.freeze({
    min,
    max,
    center: Object.freeze({ x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 }),
    size: Object.freeze({ x: max.x - min.x, y: max.y - min.y, z: max.z - min.z })
  });
}

/** Rejects impossible architectural scalar dimensions before they reach WebGL. */
function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite length.`);
  }
}

/** Removes redundant collinear indices from triangulation without changing the contour. */
function removeCollinearTriangulationVertices(
  contour: readonly ScenePlanVector3D[],
  indices: number[]
): void {
  let changed = true;
  while (changed && indices.length > 3) {
    changed = false;
    for (let index = 0; index < indices.length; index += 1) {
      const previous = indices[(index - 1 + indices.length) % indices.length]!;
      const current = indices[index]!;
      const next = indices[(index + 1) % indices.length]!;
      if (Math.abs(cross2D(contour[previous]!, contour[current]!, contour[next]!)) <= 1e-12) {
        indices.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
}

/** Returns the signed area of a simple contour in the XZ plane. */
function signedContourArea(contour: readonly ScenePlanVector3D[]): number {
  return contour.reduce((value, point, index) => {
    const next = contour[(index + 1) % contour.length]!;
    return value + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

/** Returns the oriented 2D cross product for three XZ points. */
function cross2D(
  first: ScenePlanVector3D,
  second: ScenePlanVector3D,
  third: ScenePlanVector3D
): number {
  return (second.x - first.x) * (third.z - first.z) -
    (second.z - first.z) * (third.x - first.x);
}

/** Tests whether a point lies inside or on a triangle in the XZ plane. */
function pointInTriangle(
  point: ScenePlanVector3D,
  first: ScenePlanVector3D,
  second: ScenePlanVector3D,
  third: ScenePlanVector3D
): boolean {
  const firstCross = cross2D(first, second, point);
  const secondCross = cross2D(second, third, point);
  const thirdCross = cross2D(third, first, point);
  const hasNegative = firstCross < -1e-12 || secondCross < -1e-12 || thirdCross < -1e-12;
  const hasPositive = firstCross > 1e-12 || secondCross > 1e-12 || thirdCross > 1e-12;
  return !(hasNegative && hasPositive);
}
