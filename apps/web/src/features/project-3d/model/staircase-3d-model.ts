import type { MetricLengthUnit, Staircase, StairFlight } from "@casastudio/schema";
import { architectural3DProfile, type Architectural3DProfile } from "./architectural-3d-profile";
import {
  createBoundsFromPoints, projectPointToThree, toThreeLength,
  type SceneBounds3D, type ScenePlanVector3D, type ScenePoint3D
} from "./architectural-scene-3d-model";
import {
  extrudeFlightSection3D, mergeArchitecturalSolids3D, type ArchitecturalSolid3D
} from "./architectural-solid-3d";
import {
  deriveStairPlanGeometry, type StairLandingPlanGeometry
} from "../../stair/model/stair-plan-geometry";

/** A single exact tread interval and the wedge above the inclined structural plane. */
export type StairStep3D = Readonly<{
  startAlong: number;
  endAlong: number;
  riserBottom: number;
  elevation: number;
  solid: ArchitecturalSolid3D;
}>;

/** Canonical Flight expressed in a stable horizontal frame with exact derived solids. */
export type StairFlight3D = Readonly<{
  id: string;
  start: ScenePoint3D;
  end: ScenePoint3D;
  forward: ScenePlanVector3D;
  lateral: ScenePlanVector3D;
  run: number;
  rise: number;
  width: number;
  stepCount: number;
  steps: readonly StairStep3D[];
  /** Constant thickness normal to the structural planes. */
  slabThickness: number;
  /** Vertical separation of the parallel planes at a fixed plan position. */
  slabVerticalDepth: number;
  slab: ArchitecturalSolid3D;
}>;

/** Horizontal Landing volume with topology-derived frame and Flight interfaces. */
export type StairLanding3D = Readonly<{
  id: string;
  center: ScenePoint3D;
  entry: ScenePoint3D;
  exit: ScenePoint3D;
  width: number;
  depth: number;
  thickness: number;
  forward: ScenePlanVector3D;
  lateral: ScenePlanVector3D;
  topology: "TURN" | "RETURN";
  solid: ArchitecturalSolid3D;
}>;

/** Level-owned semantic aggregate, independent of Stair authoring templates and renderer APIs. */
export type Staircase3D = Readonly<{
  id: string;
  name?: string;
  fromLevelId: string;
  toLevelId: string;
  fromRoomId?: string;
  toRoomId?: string;
  width: number;
  flights: readonly StairFlight3D[];
  landings: readonly StairLanding3D[];
  stepsSolid: ArchitecturalSolid3D;
  slabSolid: ArchitecturalSolid3D;
  landingsSolid: ArchitecturalSolid3D;
  bounds?: SceneBounds3D;
}>;

/** Maps a Flight-local position into the shared scene coordinate system. */
export function stairFlightPoint3D(
  flight: Pick<StairFlight3D, "start" | "end" | "run" | "forward" | "lateral">,
  along: number, lateral: number, y: number
): ScenePoint3D {
  // Preserve the actual canonical endpoint instead of reconstructing it by multiplication.
  const anchor = along === flight.run ? flight.end : flight.start;
  const distance = along === flight.run ? 0 : along;
  return Object.freeze({
    x: anchor.x + flight.forward.x * distance + flight.lateral.x * lateral,
    y,
    z: anchor.z + flight.forward.z * distance + flight.lateral.z * lateral
  });
}

/**
 * Returns building-space soffit Y in meters at a scene X/Z point inside the Flight.
 * Outside the footprint returns undefined; no clamping invents clearance beyond the slab.
 * The structural top joins the canonical start/end elevations; the bottom is parallel.
 */
export function getStairUndersideElevation3D(
  flight: StairFlight3D, point: ScenePlanVector3D
): number | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return undefined;
  const dx = point.x - flight.start.x;
  const dz = point.z - flight.start.z;
  const along = dx * flight.forward.x + dz * flight.forward.z;
  const across = dx * flight.lateral.x + dz * flight.lateral.z;
  const epsilon = 1e-9;
  if (along < -epsilon || along > flight.run + epsilon || Math.abs(across) > flight.width / 2 + epsilon) return undefined;
  const fraction = Math.max(0, Math.min(1, along / flight.run));
  return interpolateElevation(flight.start.y, flight.end.y, fraction) - flight.slabVerticalDepth;
}

/** Derives real steps and a constant-normal-thickness slab from canonical building-space input. */
export function createStairFlight3D(
  source: StairFlight, unit: MetricLengthUnit, profile: Architectural3DProfile = architectural3DProfile
): StairFlight3D {
  const start = projectPointToThree(source.start, source.startElevation, unit);
  const end = projectPointToThree(source.end, source.endElevation, unit);
  const run = Math.hypot(end.x - start.x, end.z - start.z);
  const rise = end.y - start.y;
  const width = toThreeLength(source.width, unit);
  if (![start.x, start.y, start.z, end.x, end.y, end.z].every(Number.isFinite) ||
    ![run, rise, width, profile.stairSlabThickness].every((v) => Number.isFinite(v) && v > 0) ||
    !Number.isSafeInteger(source.stepCount) || source.stepCount <= 0) {
    throw new Error(`Stair Flight "${source.id}" has invalid endpoints, dimensions, rise, or step count.`);
  }
  const forward = Object.freeze({ x: (end.x - start.x) / run, z: (end.z - start.z) / run });
  const lateral = Object.freeze({ x: -forward.z, z: forward.x });
  const frame = { start, end, forward, lateral, run };
  const pointAt = (along: number, across: number, y: number) => stairFlightPoint3D(frame, along, across, y);
  const steps = Array.from({ length: source.stepCount }, (_, index): StairStep3D => {
    const startFraction = index / source.stepCount;
    const endFraction = (index + 1) / source.stepCount;
    const startAlong = run * startFraction;
    const endAlong = index === source.stepCount - 1 ? run : run * endFraction;
    const riserBottom = interpolateElevation(start.y, end.y, startFraction);
    const elevation = interpolateElevation(start.y, end.y, endFraction);
    return Object.freeze({ startAlong, endAlong, riserBottom, elevation,
      solid: extrudeFlightSection3D([
        { along: startAlong, y: riserBottom },
        { along: startAlong, y: elevation },
        { along: endAlong, y: elevation }
      ], width, pointAt)
    });
  });
  const slabVerticalDepth = profile.stairSlabThickness * Math.hypot(1, rise / run);
  const slab = extrudeFlightSection3D([
    { along: 0, y: start.y }, { along: run, y: end.y },
    { along: run, y: end.y - slabVerticalDepth }, { along: 0, y: start.y - slabVerticalDepth }
  ], width, pointAt);
  return Object.freeze({ id: source.id, ...frame, rise, width, stepCount: source.stepCount,
    steps: Object.freeze(steps), slabThickness: profile.stairSlabThickness, slabVerticalDepth, slab });
}

/**
 * Converts a renderer-neutral Landing frame into a closed horizontal volume.
 * Entry and exit are exact plan interfaces shared with the adjacent effective Flights.
 */
export function createStairLanding3D(
  source: StairLandingPlanGeometry,
  unit: MetricLengthUnit, profile: Architectural3DProfile = architectural3DProfile
): StairLanding3D {
  const center = projectPointToThree(source.center, source.landing.elevation, unit);
  const entry = projectPointToThree(source.entry, source.landing.elevation, unit);
  const exit = projectPointToThree(source.exit, source.landing.elevation, unit);
  const width = toThreeLength(source.width, unit);
  const depth = toThreeLength(source.depth, unit);
  const thickness = profile.stairSlabThickness;
  if (![center.x, center.y, center.z].every(Number.isFinite) ||
    ![width, depth, thickness].every((v) => Number.isFinite(v) && v > 0)) {
    throw new Error(`Stair Landing "${source.landing.id}" has invalid position or dimensions.`);
  }
  const forward = Object.freeze({ x: source.forward.x, z: -source.forward.z });
  const lateral = Object.freeze({ x: source.lateral.x, z: -source.lateral.z });
  const solid = extrudeFlightSection3D([
    { along: -depth / 2, y: center.y }, { along: depth / 2, y: center.y },
    { along: depth / 2, y: center.y - thickness }, { along: -depth / 2, y: center.y - thickness }
  ], width, (along, lateral, y) => ({
    x: center.x + forward.x * along + source.lateral.x * lateral,
    y, z: center.z + forward.z * along - source.lateral.z * lateral
  }));
  return Object.freeze({ id: source.landing.id, center, entry, exit, width, depth, thickness,
    forward, lateral, topology: source.topology, solid });
}

/** Derives the complete canonical aggregate once, suitable for memoized rendering and bounds. */
export function createStaircase3D(
  source: Staircase, unit: MetricLengthUnit, profile: Architectural3DProfile = architectural3DProfile
): Staircase3D {
  const plan = deriveStairPlanGeometry(source);
  const flights = Object.freeze(plan.flights.map((flight) => createStairFlight3D(flight, unit, profile)));
  const landings = Object.freeze(plan.landings.map((landing) => createStairLanding3D(landing, unit, profile)));
  const stepsSolid = mergeArchitecturalSolids3D(flights.flatMap((flight) => flight.steps.map((step) => step.solid)));
  const slabSolid = mergeArchitecturalSolids3D(flights.map((flight) => flight.slab));
  const landingsSolid = mergeArchitecturalSolids3D(landings.map((landing) => landing.solid));
  const points: ScenePoint3D[] = [];
  for (const solid of [stepsSolid, slabSolid, landingsSolid]) {
    for (let i = 0; i < solid.positions.length; i += 3) {
      points.push({ x: solid.positions[i]!, y: solid.positions[i + 1]!, z: solid.positions[i + 2]! });
    }
  }
  return Object.freeze({ id: source.id, name: source.name, fromLevelId: source.fromLevelId,
    toLevelId: source.toLevelId, fromRoomId: source.fromRoomId, toRoomId: source.toRoomId,
    width: toThreeLength(source.width, unit), flights, landings, stepsSolid, slabSolid, landingsSolid,
    bounds: createBoundsFromPoints(points) });
}

function interpolateElevation(start: number, end: number, fraction: number): number {
  return fraction === 1 ? end : fraction === 0 ? start : start + (end - start) * fraction;
}
