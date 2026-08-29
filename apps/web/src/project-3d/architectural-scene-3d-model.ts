import {
  convertPhysicalLength,
  type MetricLengthUnit,
  type Project
} from "@casastudio/schema";

/** Plain immutable point in the renderer's meter-scaled XYZ coordinate space. */
export type ScenePoint3D = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

/** Axis-aligned bounds expressed in Three world units. */
export type SceneBounds3D = Readonly<{
  min: ScenePoint3D;
  max: ScenePoint3D;
  center: ScenePoint3D;
  size: ScenePoint3D;
}>;

/** Horizontal bounds for a level's canonical wall reference lines. */
export type LevelBounds3D = Readonly<{
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}>;

/** Plain line segment derived from one authoritative Project wall. */
export type LevelReferenceSegment3D = Readonly<{
  start: Readonly<{ x: number; z: number }>;
  end: Readonly<{ x: number; z: number }>;
}>;

/** Presentation reference for one authoritative architectural Level. */
export type LevelReference3D = Readonly<{
  id: string;
  name: string;
  elevation: number;
  y: number;
  bounds?: LevelBounds3D;
  segments: readonly LevelReferenceSegment3D[];
}>;

/** Pure renderer-neutral presentation model derived from an authoritative Project. */
export type ArchitecturalScene3DModel = Readonly<{
  sourceProjectId: string;
  worldLengthUnit: "m";
  levels: readonly LevelReference3D[];
  bounds?: SceneBounds3D;
  hasArchitecturalGeometry: boolean;
}>;

/** Presentation-only visibility modes for architectural Level references. */
export type LevelVisibility3D = "all" | "active";

/** Orientation of one ordered closed Level reference network on the XZ plane. */
export type LevelReferenceOrientation3D =
  | "counter-clockwise"
  | "clockwise"
  | "degenerate"
  | "open";

/** Converts a physical length to the renderer's meter-scaled world units. */
export function toThreeLength(
  value: number,
  sourceUnit: MetricLengthUnit
): number {
  return convertPhysicalLength(value, sourceUnit, "m");
}

/**
 * Maps Project plan coordinates into the Three XZ plane using the same visual
 * axis convention as the authoritative 2D viewport.
 *
 * Project +X remains Three +X. Project +Z, which appears upward in the 2D SVG,
 * maps to Three -Z so an elevated plan-aligned camera preserves that ordering.
 */
export function projectPlanPointToThree(
  point: Readonly<{ x: number; z: number }>,
  sourceUnit: MetricLengthUnit
): Readonly<{ x: number; z: number }> {
  const z = toThreeLength(point.z, sourceUnit);
  return Object.freeze({
    x: toThreeLength(point.x, sourceUnit),
    z: z === 0 ? 0 : -z
  });
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

/** Derives the minimal immutable 3D presentation model from canonical Project data. */
export function createArchitecturalScene3DModel(
  project: Project
): ArchitecturalScene3DModel {
  const sourceUnit = project.units.length;
  const levels = project.building.levels.map<LevelReference3D>((level) => {
    const segments = level.walls.map<LevelReferenceSegment3D>((wall) =>
      Object.freeze({
        start: projectPlanPointToThree(wall.start, sourceUnit),
        end: projectPlanPointToThree(wall.end, sourceUnit)
      })
    );
    const bounds = collectLevelBounds3D(segments);

    return Object.freeze({
      id: level.id,
      name: level.name,
      elevation: level.elevation,
      y: toThreeLength(level.elevation, sourceUnit),
      bounds,
      segments: Object.freeze(segments)
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

/** Returns the Level references currently visible without mutating the scene model. */
export function getVisibleLevelReferences3D(
  model: ArchitecturalScene3DModel,
  visibility: LevelVisibility3D,
  activeLevelId?: string
): readonly LevelReference3D[] {
  if (visibility === "all") return model.levels;
  const activeLevel = model.levels.find((level) => level.id === activeLevelId);
  return activeLevel ? Object.freeze([activeLevel]) : Object.freeze([]);
}

/** Derives physical scene bounds for the currently visible Level references. */
export function collectVisibleSceneBounds3D(
  model: ArchitecturalScene3DModel,
  visibility: LevelVisibility3D,
  activeLevelId?: string
): SceneBounds3D | undefined {
  return collectSceneBounds3D(
    getVisibleLevelReferences3D(model, visibility, activeLevelId)
  );
}

/** Classifies an ordered closed reference network without creating Three objects. */
export function getLevelReferenceOrientation3D(
  level: LevelReference3D
): LevelReferenceOrientation3D {
  if (level.segments.length < 3) return "open";
  const closed = level.segments.every((segment, index) => {
    const next = level.segments[(index + 1) % level.segments.length]!;
    return segment.end.x === next.start.x && segment.end.z === next.start.z;
  });
  if (!closed) return "open";
  const doubledArea = level.segments.reduce(
    (area, segment) =>
      area + segment.start.x * segment.end.z - segment.end.x * segment.start.z,
    0
  );
  if (doubledArea === 0) return "degenerate";
  return doubledArea > 0 ? "counter-clockwise" : "clockwise";
}

/** Collects horizontal bounds from real canonical wall reference segments. */
function collectLevelBounds3D(
  segments: readonly LevelReferenceSegment3D[]
): LevelBounds3D | undefined {
  if (segments.length === 0) return undefined;

  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const segment of segments) {
    minX = Math.min(minX, segment.start.x, segment.end.x);
    minZ = Math.min(minZ, segment.start.z, segment.end.z);
    maxX = Math.max(maxX, segment.start.x, segment.end.x);
    maxZ = Math.max(maxZ, segment.start.z, segment.end.z);
  }

  return Object.freeze({ minX, minZ, maxX, maxZ });
}

/** Combines visible Level footprint and elevation bounds in renderer coordinates. */
function collectSceneBounds3D(
  levels: readonly LevelReference3D[]
): SceneBounds3D | undefined {
  const levelsWithGeometry = levels.filter((level) => level.bounds);
  if (levelsWithGeometry.length === 0) return undefined;

  const min = Object.freeze({
    x: Math.min(...levelsWithGeometry.map((level) => level.bounds!.minX)),
    y: Math.min(...levelsWithGeometry.map((level) => level.y)),
    z: Math.min(...levelsWithGeometry.map((level) => level.bounds!.minZ))
  });
  const max = Object.freeze({
    x: Math.max(...levelsWithGeometry.map((level) => level.bounds!.maxX)),
    y: Math.max(...levelsWithGeometry.map((level) => level.y)),
    z: Math.max(...levelsWithGeometry.map((level) => level.bounds!.maxZ))
  });

  return Object.freeze({
    min,
    max,
    center: Object.freeze({
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    }),
    size: Object.freeze({
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z
    })
  });
}
