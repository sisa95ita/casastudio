import type { StairFlight } from "@casastudio/schema";
import { describe, expect, it } from "vitest";
import { demoProjectFixture } from "../../../test/demo-project-fixture";
import { createVerticalArchitectureFixture } from "../../../test/vertical-architecture-fixture";
import { architectural3DProfile } from "./architectural-3d-profile";
import { createFloorSolid3D, floorSurfaceMaterialRoles3D } from "./floor-solid-3d";
import { createArchitecturalScene3DModel, collectVisibleSceneBounds3D, getVisibleLevelReferences3D, triangulateFloorContour3D, type ScenePoint3D } from "./architectural-scene-3d-model";
import { createStairFlight3D, createStairLanding3D, getStairUndersideElevation3D, stairFlightPoint3D } from "./staircase-3d-model";
import type { ArchitecturalSolid3D } from "./architectural-solid-3d";
import { createArchitecturalCameraPose3D, projectScenePointToArchitecturalScreen3D } from "../camera/architectural-camera-3d";
import { collectArchitecturalSelectionTargets3D, resolveArchitecturalSelection3D, isArchitecturalSelectionVisible3D, getArchitecturalEntityKey3D } from "../interaction/architectural-selection-3d";
import { getArchitecturalEntityPresentationState3D } from "../interaction/architectural-viewer-interaction-3d";
import { angleToProjectPlanVector, createStairProposal } from "../../editor-2d/tools/stair/project-stair-authoring";

const baseFlight: StairFlight = { id: "flight", start: { x: 70, z: -40 }, end: { x: 430, z: -40 },
  width: 100, stepCount: 13, startElevation: 120, endElevation: 343 };

describe("renderer-neutral vertical architecture", () => {
  it.each([0, 90, 37])("preserves authored %d° Flight direction through Project X/Z to Three X/-Z", (rotation) => {
    const direction = angleToProjectPlanVector(rotation)!;
    const start = { x: 70, z: -40 };
    const run = 13 * 28;
    const proposal = createStairProposal({
      project: createVerticalArchitectureFixture(demoProjectFixture, "straight", false),
      owningLevelId: "ground",
      destination: { toLevelId: "ground", toRoomId: "elevated" },
      fromRoomId: "lower",
      template: "STRAIGHT",
      parameters: { kind: "STRAIGHT", width: 100, flightStepCount: 13, treadDepth: 28 },
      start,
      control: { x: start.x + direction.x * run, z: start.z + direction.z * run },
      identifiers: { staircaseId: "parity-stair", flightIds: ["parity-flight"], landingIds: [] }
    })!;
    const flight2D = proposal.staircase.flights[0]!;
    const flight3D = createStairFlight3D(flight2D, "cm");
    expect(flight3D.start.x).toBeCloseTo(flight2D.start.x / 100);
    expect(flight3D.start.z).toBeCloseTo(-flight2D.start.z / 100);
    expect(flight3D.end.x).toBeCloseTo(flight2D.end.x / 100);
    expect(flight3D.end.z).toBeCloseTo(-flight2D.end.z / 100);
    expect(flight3D.forward.x).toBeCloseTo(direction.x);
    expect(flight3D.forward.z).toBeCloseTo(-direction.z);
  });

  it.each([{ x: 430, z: -40 }, { x: 70, z: 320 }, { x: 286, z: 248 }, { x: -146, z: -328 }])(
    "derives exact subdivision, frame and soffit for endpoint %j", (end) => {
      const flight = createStairFlight3D({ ...baseFlight, end }, "cm");
      expect(flight.run).toBeCloseTo(3.6);
      expect(Math.hypot(flight.forward.x, flight.forward.z)).toBeCloseTo(1);
      expect(flight.forward.x * flight.lateral.x + flight.forward.z * flight.lateral.z).toBeCloseTo(0);
      expect(flight.steps).toHaveLength(13);
      expect(flight.steps[0]!.startAlong).toBe(0);
      expect(flight.steps.at(-1)!.endAlong).toBe(flight.run);
      expect(flight.steps.at(-1)!.elevation).toBe(flight.end.y);
      expect(stairFlightPoint3D(flight, flight.run, 0, flight.end.y)).toEqual(flight.end);
      let previous = -Infinity;
      for (const [index, step] of flight.steps.entries()) {
        expect(step.endAlong - step.startAlong).toBeCloseTo(flight.run / 13);
        expect(step.elevation - step.riserBottom).toBeCloseTo(flight.rise / 13);
        if (index > 0) expect(step.riserBottom).toBe(flight.steps[index - 1]!.elevation);
        const point = stairFlightPoint3D(flight, step.startAlong, 0, 0);
        const underside = getStairUndersideElevation3D(flight, point)!;
        expect(underside).toBeGreaterThan(previous);
        expect((step.riserBottom - underside) / Math.hypot(1, flight.rise / flight.run)).toBeCloseTo(flight.slabThickness);
        previous = underside;
        expectClosedOutwardSolid(step.solid, flight.width * (step.endAlong - step.startAlong) * (step.elevation - step.riserBottom) / 2);
      }
      expectClosedOutwardSolid(flight.slab, flight.run * flight.width * flight.slabVerticalDepth);
      expect(getStairUndersideElevation3D(flight, flight.start)).toBeCloseTo(flight.start.y - flight.slabVerticalDepth);
      expect(getStairUndersideElevation3D(flight, flight.end)).toBeCloseTo(flight.end.y - flight.slabVerticalDepth);
      expect(getStairUndersideElevation3D(flight, stairFlightPoint3D(flight, -0.01, 0, 0))).toBeUndefined();
      expect(getStairUndersideElevation3D(flight, stairFlightPoint3D(flight, flight.run / 2, 0.51, 0))).toBeUndefined();
      expect(getStairUndersideElevation3D(flight, { x: NaN, z: 0 })).toBeUndefined();
    }
  );

  it.each([
    { end: baseFlight.start }, { stepCount: 0 }, { stepCount: 2.5 }, { width: 0 },
    { endElevation: 120 }, { startElevation: NaN }, { end: { x: Infinity, z: 0 } }
  ])("rejects invalid Flight geometry %j before producing meshes", (invalid) => {
    expect(() => createStairFlight3D({ ...baseFlight, ...invalid }, "cm")).toThrow(/invalid/);
  });

  it("keeps physical scale and profile independent of canonical source units", () => {
    const cm = createStairFlight3D(baseFlight, "cm");
    const meters = createStairFlight3D({ ...baseFlight,
      start: { x: 0.7, z: -0.4 }, end: { x: 4.3, z: -0.4 }, width: 1,
      startElevation: 1.2, endElevation: 3.43 }, "m");
    expect(meters).toEqual(cm);
    const custom = createStairFlight3D(baseFlight, "cm", { floorThickness: 0.2, stairSlabThickness: 0.21 });
    expect(custom.slabThickness).toBe(0.21);
  });

  it("places an angled non-square Landing using the corresponding Flight frame", () => {
    const flight = createStairFlight3D({ ...baseFlight, end: { x: -146, z: -328 } }, "cm");
    const landingSource = { id: "landing", position: { x: -146, z: -328 }, width: 200, depth: 100, elevation: 343 };
    const frame = { landing: landingSource, center: landingSource.position,
      entry: { x: -116, z: -288 }, exit: { x: -176, z: -368 },
      forward: { x: flight.forward.x, z: -flight.forward.z },
      lateral: { x: flight.lateral.x, z: -flight.lateral.z }, topology: "TURN" as const,
      width: landingSource.width, depth: landingSource.depth };
    const landing = createStairLanding3D(frame, "cm");
    expect(landing.center).toEqual(flight.end);
    expect(landing.forward).toEqual(flight.forward);
    expect(landing.width).toBe(2);
    expect(landing.depth).toBe(1);
    expect(landing.thickness).toBe(architectural3DProfile.stairSlabThickness);
    expectClosedOutwardSolid(landing.solid, 2 * landing.thickness);
    expect(() => createStairLanding3D({ ...frame,
      landing: { ...landingSource, id: "bad", width: 0 }, width: 0 }, "cm")).toThrow(/invalid/);
  });

  it.each(["straight", "L", "U"] as const)("derives continuous canonical %s aggregates with independent overlapping Room floors", (layout) => {
    for (const crossLevel of [false, true]) {
      const project = createVerticalArchitectureFixture(demoProjectFixture, layout, crossLevel);
      const model = createArchitecturalScene3DModel(project);
      const stair = model.levels[0]!.staircases[0]!;
      const floors = model.levels.flatMap((level) => level.floors);
      const lower = floors.find((floor) => floor.roomId === "lower")!;
      const elevated = floors.find((floor) => floor.roomId === "elevated")!;
      expect(lower.y).toBe(0);
      expect(lower.bottomY).toBe(-0.18);
      expect(elevated.y).toBe(crossLevel ? 3 : 2.2);
      expect(elevated.bottomY).toBeCloseTo(elevated.y - 0.18);
      expect(stair.flights[0]!.start.y).toBe(lower.y);
      expect(stair.flights.at(-1)!.steps.at(-1)!.elevation).toBe(elevated.y);
      expect(stair.flights).toHaveLength(layout === "straight" ? 1 : 2);
      expect(stair.landings).toHaveLength(layout === "straight" ? 0 : 1);
      expect(model.levels.flatMap((level) => level.walls)).toEqual([]);
      expect(floors).toHaveLength(2);
      if (stair.landings[0]) {
        const landing = stair.landings[0];
        expect(landing.center.y).toBe(stair.flights[0]!.end.y);
        expect(landing.center.y).toBe(stair.flights[1]!.start.y);
        expectPoint3D(landing.entry, stair.flights[0]!.end);
        expectPoint3D(landing.exit, stair.flights[1]!.start);
        expect(stair.flights[0]!.steps.at(-1)!.elevation).toBe(landing.center.y);
        expect(stair.flights[1]!.steps[0]!.riserBottom).toBe(landing.center.y);
        expect(getStairUndersideElevation3D(stair.flights[0]!, landing.entry))
          .toBeCloseTo(stair.flights[0]!.end.y - stair.flights[0]!.slabVerticalDepth);
        expect(getStairUndersideElevation3D(stair.flights[1]!, landing.exit))
          .toBeCloseTo(stair.flights[1]!.start.y - stair.flights[1]!.slabVerticalDepth);
        for (const point of [stair.flights[0]!.end, stair.flights[1]!.start]) {
          const dx = point.x - landing.center.x, dz = point.z - landing.center.z;
          expect(Math.abs(dx * landing.forward.x + dz * landing.forward.z)).toBeLessThanOrEqual(landing.depth / 2);
          expect(Math.abs(-dx * landing.forward.z + dz * landing.forward.x)).toBeLessThanOrEqual(landing.width / 2);
        }
      }
      for (const solid of [stair.stepsSolid, stair.slabSolid, stair.landingsSolid]) {
        for (const point of vertices(solid)) {
          for (const axis of ["x", "y", "z"] as const) {
            expect(point[axis]).toBeGreaterThanOrEqual(stair.bounds!.min[axis]);
            expect(point[axis]).toBeLessThanOrEqual(stair.bounds!.max[axis]);
          }
        }
      }
      expect(getVisibleLevelReferences3D(model, "active", "ground")[0]!.staircases).toEqual([stair]);
      if (crossLevel) expect(getVisibleLevelReferences3D(model, "active", "upper")[0]!.staircases).toEqual([]);
      expect(collectVisibleSceneBounds3D(model, "active", "ground")!.max.y).toBeGreaterThanOrEqual(stair.bounds!.max.y);
      const pose = createArchitecturalCameraPose3D(model.bounds, 0.7);
      for (const x of [model.bounds!.min.x, model.bounds!.max.x]) for (const y of [model.bounds!.min.y, model.bounds!.max.y]) for (const z of [model.bounds!.min.z, model.bounds!.max.z]) {
        const screen = projectScenePointToArchitecturalScreen3D({ x, y, z }, pose, 0.7)!;
        expect(Math.abs(screen.x)).toBeLessThan(1);
        expect(Math.abs(screen.y)).toBeLessThan(1);
        expect(screen.depth).toBeGreaterThan(pose.near);
        expect(screen.depth).toBeLessThan(pose.far);
      }
      const identity = { kind: "staircase", id: "stair", levelId: "ground" } as const;
      const selection = resolveArchitecturalSelection3D(model, identity)!;
      expect(selection.staircase).toBe(stair);
      expect(isArchitecturalSelectionVisible3D(selection, "active", "ground")).toBe(true);
      expect(isArchitecturalSelectionVisible3D(selection, "active", "upper")).toBe(false);
      expect(getArchitecturalEntityPresentationState3D(identity, "", getArchitecturalEntityKey3D(identity))).toBe("hovered");
      expect(collectArchitecturalSelectionTargets3D(model.levels).some((target) => target.identity.id === "stair")).toBe(true);
      expect(resolveArchitecturalSelection3D(model, { kind: "room", id: "elevated", levelId: crossLevel ? "upper" : "ground" })!.floor).toBe(elevated);
    }
  });

  it("preserves mixed WALL/FREE elevated extents and existing Opening sections", () => {
    const project = structuredClone(demoProjectFixture);
    const level = project.building.levels[0]!;
    const existing = createArchitecturalScene3DModel(project);
    const wall = level.walls[0]!;
    level.rooms.push({ id: "mixed", name: "Mixed", type: "STUDIO", elevation: 220, boundary: [
      { wallId: wall.id, direction: "FORWARD" },
      { kind: "FREE", start: wall.end, end: { x: 400, z: 200 } },
      { kind: "FREE", start: { x: 400, z: 200 }, end: { x: 0, z: 200 } },
      { kind: "FREE", start: { x: 0, z: 200 }, end: wall.start }
    ] });
    wall.roomIds.push("mixed");
    const model = createArchitecturalScene3DModel(project);
    expect(model.levels[0]!.walls).toEqual(existing.levels[0]!.walls);
    expect(model.levels[0]!.floors).toHaveLength(existing.levels[0]!.floors.length + 1);
    const floor = model.levels[0]!.floors.find((candidate) => candidate.roomId === "mixed")!;
    const solid = createFloorSolid3D(floor);
    expect(floor.boundaryKinds).toEqual(["WALL", "FREE", "FREE", "FREE"]);
    expect(solid.wallEdges.positions).toHaveLength(18);
    expect(solid.freeEdges.positions).toHaveLength(54);
    expect(floorSurfaceMaterialRoles3D).toEqual({
      top: "floorTop",
      wallEdge: "wall",
      freeEdge: "floorEdge",
      bottom: "floorBottom"
    });
    expectClosedOutwardSolid({ positions: [
      ...solid.top.positions,
      ...solid.wallEdges.positions,
      ...solid.freeEdges.positions,
      ...solid.bottom.positions
    ] }, 8 * 0.18);
    expect(floor.y).toBe(2.2);
    expect(floor.contour).toHaveLength(4);
  });

  it("keeps aligned upper-Level wall-backed Floor sides in the wall material batch", () => {
    const project = structuredClone(demoProjectFixture);
    const source = project.building.levels[0]!;
    const roomIds = new Map(source.rooms.map((room) => [room.id, `upper-${room.id}`]));
    const wallIds = new Map(source.walls.map((wall) => [wall.id, `upper-${wall.id}`]));
    project.building.levels.push({
      ...source,
      id: "upper-level",
      name: "Upper Level",
      elevation: 300,
      walls: source.walls.map((wall) => ({
        ...wall,
        id: wallIds.get(wall.id)!,
        roomIds: wall.roomIds.map((roomId) => roomIds.get(roomId)!),
        openings: []
      })),
      rooms: source.rooms.map((room) => ({
        ...room,
        id: roomIds.get(room.id)!,
        boundary: room.boundary.map((edge) => "kind" in edge
          ? edge
          : { ...edge, wallId: wallIds.get(edge.wallId)! })
      })),
      staircases: []
    });

    const upper = createArchitecturalScene3DModel(project).levels.find((level) => level.id === "upper-level")!;
    expect(upper.floors).toHaveLength(source.rooms.length);
    for (const floor of upper.floors) {
      expect(floor.y).toBe(3);
      expect(floor.boundaryKinds.every((kind) => kind === "WALL")).toBe(true);
      const solid = createFloorSolid3D(floor);
      expect(solid.wallEdges.positions.length).toBe(floor.contour.length * 18);
      expect(solid.freeEdges.positions).toHaveLength(0);
      expectClosedOutwardSolid({ positions: [
        ...solid.top.positions,
        ...solid.wallEdges.positions,
        ...solid.freeEdges.positions,
        ...solid.bottom.positions
      ] }, floor.area * floor.thickness);
    }
  });

  it("never adds owning Level elevation to already-global Flight elevations", () => {
    const project = createVerticalArchitectureFixture(demoProjectFixture, "straight", true);
    project.building.levels[0]!.elevation = 400;
    project.building.levels[1]!.elevation = 700;
    const flight = project.building.levels[0]!.staircases[0]!.flights[0]!;
    flight.startElevation = 400;
    flight.endElevation = 700;
    const model = createArchitecturalScene3DModel(project);
    expect(model.levels[0]!.staircases[0]!.flights[0]!.end.y).toBe(7);
    expect(model.levels[1]!.floors[0]!.y).toBe(7);
  });
});

const contours = {
  rectangle: [[0, 0], [4, 0], [4, 3], [0, 3]],
  L: [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]],
  U: [[0, 0], [4, 0], [4, 3], [3, 3], [3, 1], [1, 1], [1, 3], [0, 3]],
  T: [[0, 0], [4, 0], [4, 1], [2.5, 1], [2.5, 3], [1.5, 3], [1.5, 1], [0, 1]]
};
it.each(Object.entries(contours))("closes %s Floor tops, bottoms and sides with outward normals in either winding", (_, points) => {
  for (const ordered of [points, [...points].reverse()]) {
    const contour = ordered.map(([x, z]) => ({ x: x!, z: z! }));
    const area = Math.abs(contour.reduce((sum, p, i) => {
      const next = contour[(i + 1) % contour.length]!;
      return sum + p.x * next.z - next.x * p.z;
    }, 0) / 2);
    const floor = { id: "floor", roomId: "room", area, y: 2.2, bottomY: 2.02, thickness: 0.18,
      contour, boundaryKinds: contour.map(() => "FREE" as const), triangles: triangulateFloorContour3D(contour) };
    const solid = createFloorSolid3D(floor);
    expect(vertices(solid.top).every((point) => point.y === 2.2)).toBe(true);
    expect(solid.wallEdges.positions).toHaveLength(0);
    expect(solid.freeEdges.positions).toHaveLength(contour.length * 18);
    expectClosedOutwardSolid({ positions: [
      ...solid.top.positions,
      ...solid.wallEdges.positions,
      ...solid.freeEdges.positions,
      ...solid.bottom.positions
    ] }, area * 0.18);
    for (let i = 0; i < solid.top.positions.length; i += 9) {
      const [a, b, c] = vertices({ positions: solid.top.positions.slice(i, i + 9) });
      expect((b!.z - a!.z) * (c!.x - a!.x) - (b!.x - a!.x) * (c!.z - a!.z)).toBeGreaterThan(0);
    }
  }
});

function vertices(solid: ArchitecturalSolid3D): ScenePoint3D[] {
  const points: ScenePoint3D[] = [];
  for (let i = 0; i < solid.positions.length; i += 3) points.push({ x: solid.positions[i]!, y: solid.positions[i + 1]!, z: solid.positions[i + 2]! });
  return points;
}

function expectPoint3D(actual: ScenePoint3D, expected: ScenePoint3D) {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
}

// Signed volume detects inverted faces; matching directed edges detects open or inconsistent shells.
function expectClosedOutwardSolid(solid: ArchitecturalSolid3D, expectedVolume: number) {
  const points = vertices(solid);
  const edges = new Map<string, number>();
  const key = (p: ScenePoint3D) => [p.x, p.y, p.z].map((v) => v.toFixed(8)).join(",");
  let volume = 0;
  for (let i = 0; i < points.length; i += 3) {
    const a = points[i]!, b = points[i + 1]!, c = points[i + 2]!;
    volume += (a.x * (b.y * c.z - b.z * c.y) + a.y * (b.z * c.x - b.x * c.z) + a.z * (b.x * c.y - b.y * c.x)) / 6;
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const start = key(p!), end = key(q!);
      const id = start < end ? `${start}|${end}` : `${end}|${start}`;
      edges.set(id, (edges.get(id) ?? 0) + (start < end ? 1 : -1));
    }
  }
  expect(volume).toBeCloseTo(expectedVolume, 8);
  expect([...edges.values()].every((v) => v === 0)).toBe(true);
}
