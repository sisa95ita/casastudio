import { reverseWallDirection, type Project, type Wall } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../../../test/demo-project-fixture";
import { createGeometrySnapshotFixture } from "../../../test/geometry-snapshot-fixture";
import {
  collectVisibleSceneBounds3D,
  createArchitecturalScene3DModel,
  createWall3D,
  decomposeWallSections3D,
  getLevelReferenceOrientation3D,
  getVisibleLevelReferences3D,
  projectPointToThree,
  toThreeLength,
  triangulateFloorContour3D,
  type Opening3D,
  type ScenePlanVector3D,
  type WallSection3D
} from "./architectural-scene-3d-model";

describe("architectural 3D presentation model", () => {
  it("converts canonical centimeters and explicit meters to meter-scaled world lengths", () => {
    expect(toThreeLength(100, "cm")).toBe(1);
    expect(toThreeLength(250, "cm")).toBe(2.5);
    expect(toThreeLength(2.5, "m")).toBe(2.5);
  });

  it("maps Project plan axes to the 2D-aligned Three convention and elevation to Y", () => {
    expect(projectPointToThree({ x: 250, z: -125 }, 320, "cm")).toEqual({
      x: 2.5,
      y: 3.2,
      z: 1.25
    });
  });

  it("derives a deliberately asymmetric footprint through one plan-axis boundary", () => {
    const project = createAsymmetricProject();
    const sourcePoints = project.building.levels[0]!.walls.map((wall) => wall.start);
    const model = createArchitecturalScene3DModel(project);
    const level = model.levels[0]!;
    const derivedPoints = level.segments.map((segment) => segment.start);

    expect(signedArea(sourcePoints)).toBeGreaterThan(0);
    expect(signedArea(derivedPoints)).toBeLessThan(0);
    expect(level.segments[0]?.start.x).toBeLessThan(model.bounds!.center.x);
    expect(level.segments[0]?.start.z).toBe(4);
    expect(level.y).toBe(2.75);
    expect(getLevelReferenceOrientation3D(level)).toBe("clockwise");
  });

  it("derives immutable bounds from real Wall thickness, height, and Floor contours", () => {
    const model = createArchitecturalScene3DModel(demoProjectFixture);

    expect(model.worldLengthUnit).toBe("m");
    expect(model.hasArchitecturalGeometry).toBe(true);
    expect(model.bounds).toEqual({
      min: { x: -0.1, y: -0.18, z: -3.1 },
      max: { x: 8.1, y: 3, z: 0.1 },
      center: { x: 4, y: 1.41, z: -1.5 },
      size: { x: 8.2, y: 3.18, z: 3.2 }
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.levels[0]?.segments)).toBe(true);
  });

  it("returns no physical bounds for an empty Project", () => {
    const project = structuredClone(demoProjectFixture);
    project.building.levels = project.building.levels.map((level) => ({
      ...level,
      walls: [],
      rooms: [],
      staircases: []
    }));

    const model = createArchitecturalScene3DModel(project);

    expect(model.hasArchitecturalGeometry).toBe(false);
    expect(model.bounds).toBeUndefined();
    expect(model.levels[0]?.segments).toEqual([]);
  });

  it("uses actual multi-Level elevations in vertical scene bounds", () => {
    const project = createMultiLevelProject();
    const model = createArchitecturalScene3DModel(project);

    expect(model.levels.map((level) => level.y)).toEqual([-0.5, 0, 3.2]);
    expect(model.bounds?.min.y).toBeCloseTo(-0.68);
    expect(model.bounds?.max.y).toBe(6.2);
    expect(model.bounds?.size.y).toBeCloseTo(6.88);
  });

  it("filters Active Level references and refits only visible physical content", () => {
    const model = createArchitecturalScene3DModel(createMultiLevelProject());

    expect(getVisibleLevelReferences3D(model, "all", "level-upper")).toHaveLength(3);
    expect(getVisibleLevelReferences3D(model, "active", "level-upper").map((level) => level.id))
      .toEqual(["level-upper"]);
    expect(collectVisibleSceneBounds3D(model, "active", "level-upper")).toMatchObject({
      min: { y: 3.02 },
      max: { y: 6.2 },
      size: { y: 3.18 }
    });
    expect(getVisibleLevelReferences3D(model, "active", "missing")).toEqual([]);
    expect(collectVisibleSceneBounds3D(model, "active", "missing")).toBeUndefined();
  });

  it("derives exact axis-aligned Wall dimensions, centered thickness, and Level elevation", () => {
    const wall = createWall3D(createWall(), 125, "cm");

    expect(wall.origin).toEqual({ x: 0, y: 1.25, z: 0 });
    expect(wall.u).toEqual({ x: 1, z: 0 });
    expect(wall.n).toEqual({ x: 0, z: 1 });
    expect(wall.length).toBe(4);
    expect(wall.thickness).toBe(0.2);
    expect(wall.height).toBe(3);
    expect(wall.sections).toEqual([{ start: 0, end: 4, bottom: 0, top: 3 }]);
    expect(wall.origin.x + wall.u.x * wall.length).toBe(4);
    expect(wall.origin.z + wall.u.z * wall.length).toBe(0);
    expect(wall.origin.z + wall.n.z * wall.thickness / 2).toBe(0.1);
    expect(wall.origin.z - wall.n.z * wall.thickness / 2).toBe(-0.1);
  });

  it("derives an orthonormal local frame for angled Walls", () => {
    const wall = createWall3D(createWall({ end: { x: 300, z: 400 } }), 0, "cm");

    expect(wall.length).toBe(5);
    expect(wall.u.x).toBeCloseTo(0.6);
    expect(wall.u.z).toBeCloseTo(-0.8);
    expect(wall.n.x).toBeCloseTo(0.8);
    expect(wall.n.z).toBeCloseTo(0.6);
    expect(wall.u.x * wall.n.x + wall.u.z * wall.n.z).toBeCloseTo(0);
  });

  it("includes Wall thickness and full vertical extent in active bounds", () => {
    const project = createWallOnlyProject(createWall(), 100);
    const bounds = createArchitecturalScene3DModel(project).bounds!;

    expect(bounds).toEqual({
      min: { x: 0, y: 1, z: -0.1 },
      max: { x: 4, y: 4, z: 0.1 },
      center: { x: 2, y: 2.5, z: 0 },
      size: { x: 4, y: 3, z: 0.2 }
    });
  });

  it("extrudes endpoint-resolved Wall bodies without standalone junction geometry", () => {
    const project = createWallOnlyProject(createWall({ id: "east" }));
    project.building.levels[0]!.walls.push(createWall({
      id: "north",
      end: { x: 0, z: 400 },
      height: 250,
      thickness: 30
    }));

    const model = createArchitecturalScene3DModel(project);
    const level = model.levels[0]!;
    const east = level.walls.find((wall) => wall.id === "east")!;
    const north = level.walls.find((wall) => wall.id === "north")!;
    const eastBody = east.bodySections[0]!;
    const northBody = north.bodySections[0]!;

    expect(level).not.toHaveProperty("wallJunctions");
    expect(eastBody.contour.slice(0, 2)).toEqual([
      { x: 0.15, z: -0.1 },
      { x: -0.15, z: 0.1 }
    ]);
    expect(northBody.contour.slice(0, 2)).toEqual([
      { x: -0.15, z: 0.1 },
      { x: 0.15, z: -0.1 }
    ]);
    expect(eastBody.solid.positions).toHaveLength(108);
    expect(northBody.solid.positions).toHaveLength(108);
    expect(eastBody.solid.positions.every(Number.isFinite)).toBe(true);
    expectSolidTrianglesFaceAwayFrom(
      eastBody.solid.positions,
      {
        x: eastBody.contour.reduce((sum, point) => sum + point.x, 0) / 4,
        y: east.origin.y + east.height / 2,
        z: eastBody.contour.reduce((sum, point) => sum + point.z, 0) / 4
      }
    );
    expect(model.bounds?.min.x).toBe(-0.15);
    expect(model.bounds?.max.y).toBe(3);
  });

  it("applies endpoint interfaces only to Opening sections that touch the Wall end", () => {
    const project = createWallOnlyProject(createWall({
      id: "east",
      openings: [{
        id: "near-window",
        type: "WINDOW",
        offsetFromStart: 20,
        width: 50,
        elevation: 90,
        height: 120
      }]
    }));
    project.building.levels[0]!.walls.push(createWall({
      id: "north",
      end: { x: 0, z: 400 }
    }));

    const east = createArchitecturalScene3DModel(project).levels[0]!.walls
      .find((wall) => wall.id === "east")!;
    const endpointSections = east.bodySections.filter((section) => section.start === 0);
    const interiorSections = east.bodySections.filter((section) => section.start === 0.2);

    expect(east.openings[0]).toMatchObject({ offsetFromStart: 0.2, width: 0.5 });
    expect(endpointSections).toHaveLength(1);
    expect(endpointSections[0]!.contour[0]).toEqual({ x: 0.1, z: -0.1 });
    expect(interiorSections).toHaveLength(2);
    expect(interiorSections.every((section) => section.contour[0].x === 0.2)).toBe(true);
    expect(isSolidAt(east.sections, 0.45, 1.5)).toBe(false);
  });

  it("keeps a through Wall continuous while trimming a T branch to its face", () => {
    const project = createWallOnlyProject(createWall({
      id: "west",
      end: { x: -400, z: 0 }
    }));
    project.building.levels[0]!.walls.push(
      createWall({ id: "east" }),
      createWall({ id: "north", end: { x: 0, z: 400 } })
    );

    const level = createArchitecturalScene3DModel(project).levels[0]!;
    const west = level.walls.find((wall) => wall.id === "west")!.bodySections[0]!;
    const east = level.walls.find((wall) => wall.id === "east")!.bodySections[0]!;
    const north = level.walls.find((wall) => wall.id === "north")!.bodySections[0]!;

    expect(west.contour.slice(0, 2)).toEqual([
      { x: 0, z: 0.1 },
      { x: 0, z: -0.1 }
    ]);
    expect(east.contour.slice(0, 2)).toEqual([
      { x: 0, z: -0.1 },
      { x: 0, z: 0.1 }
    ]);
    expect(north.contour.slice(0, 2)).toEqual([
      { x: -0.1, z: -0.1 },
      { x: 0.1, z: -0.1 }
    ]);
    expect(level).not.toHaveProperty("wallJunctions");
    expect(level.bounds).toEqual(expect.objectContaining({
      minX: expect.any(Number),
      minZ: expect.any(Number),
      maxX: expect.any(Number),
      maxZ: expect.any(Number)
    }));
  });

  it("decomposes a Wall without Openings into one full solid", () => {
    expect(decomposeWallSections3D(10, 3, [])).toEqual([
      { start: 0, end: 10, bottom: 0, top: 3 }
    ]);
  });

  it("creates a Door void from floor to exact Door height", () => {
    const sections = decomposeWallSections3D(10, 3, [opening({
      kind: "DOOR",
      offsetFromStart: 2,
      width: 1,
      elevation: 0,
      height: 2.1
    })]);

    expect(isSolidAt(sections, 2.5, 1)).toBe(false);
    expect(isSolidAt(sections, 2.5, 2.5)).toBe(true);
    expect(isSolidAt(sections, 1, 1)).toBe(true);
  });

  it("creates a Window void while retaining sill, header, and side piers", () => {
    const sections = decomposeWallSections3D(10, 3, [opening({
      kind: "WINDOW",
      offsetFromStart: 3,
      width: 2,
      elevation: 0.9,
      height: 1.2
    })]);

    expect(isSolidAt(sections, 4, 0.5)).toBe(true);
    expect(isSolidAt(sections, 4, 1.5)).toBe(false);
    expect(isSolidAt(sections, 4, 2.5)).toBe(true);
    expect(isSolidAt(sections, 2, 1.5)).toBe(true);
  });

  it("uses identical rectangular subtraction for a generic Wall Opening", () => {
    const sections = decomposeWallSections3D(8, 3, [opening({
      kind: "OPENING",
      offsetFromStart: 1,
      width: 2,
      elevation: 0,
      height: 2.4
    })]);

    expect(isSolidAt(sections, 2, 1)).toBe(false);
    expect(isSolidAt(sections, 2, 2.7)).toBe(true);
  });

  it("supports multiple and edge-touching Openings with exact breakpoints", () => {
    const sections = decomposeWallSections3D(10, 3, [
      opening({ id: "door", kind: "DOOR", offsetFromStart: 0, width: 1, elevation: 0, height: 2 }),
      opening({ id: "window-a", offsetFromStart: 2, width: 2, elevation: 1, height: 1 }),
      opening({ id: "window-b", offsetFromStart: 4, width: 2, elevation: 1, height: 1 })
    ]);

    expect(isSolidAt(sections, 0.5, 1)).toBe(false);
    expect(isSolidAt(sections, 3, 1.5)).toBe(false);
    expect(isSolidAt(sections, 4, 1.5)).toBe(false);
    expect(isSolidAt(sections, 5, 1.5)).toBe(false);
    expect(isSolidAt(sections, 7, 1.5)).toBe(true);
    expect(sections.some((section) => section.start === 4 || section.end === 4)).toBe(true);
  });

  it("preserves exact Opening values and uses the same decomposition on angled Walls", () => {
    const canonical = createWall({
      end: { x: 300, z: 400 },
      openings: [{
        id: "angled-window",
        type: "WINDOW",
        offsetFromStart: 125,
        width: 150,
        elevation: 80,
        height: 120
      }]
    });
    const wall = createWall3D(canonical, 0, "cm");

    expect(wall.openings[0]).toMatchObject({
      offsetFromStart: 1.25,
      width: 1.5,
      elevation: 0.8,
      height: 1.2
    });
    expect(wall.sections).toEqual(decomposeWallSections3D(
      wall.length,
      wall.height,
      wall.openings
    ));
  });

  it("keeps an Opening at the same physical location after canonical Wall reversal", () => {
    const project = createWallOnlyProject(createWall({ openings: [{
      id: "reversible-window",
      type: "WINDOW",
      offsetFromStart: 75,
      width: 125,
      elevation: 80,
      height: 120
    }] }));
    const before = createArchitecturalScene3DModel(project).levels[0]!.walls[0]!;
    const result = reverseWallDirection(project, "wall");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = createArchitecturalScene3DModel(result.project).levels[0]!.walls[0]!;

    expect(openingWorldEndpoints(before)).toEqual(openingWorldEndpoints(after).reverse());
  });

  it("derives independent exact Room Floor contours from Geometry Engine polygons", () => {
    const model = createArchitecturalScene3DModel(demoProjectFixture);
    const floors = model.levels[0]!.floors;

    expect(floors).toHaveLength(2);
    expect(floors.map((floor) => floor.roomId)).toEqual(["left-room", "right-room"]);
    expect(floors[0]!.contour).toEqual([
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: -3 },
      { x: 0, z: -3 }
    ]);
    expect(floors[0]!.triangles).toHaveLength(2);
    expect(floors.every((floor) => floor.y === 0)).toBe(true);
  });

  it("places elevated Room Floors at the same derived Y for local and Snapshot geometry paths", () => {
    const project = structuredClone(demoProjectFixture);
    const level = project.building.levels[0]!;
    const room = level.rooms[0]!;
    room.elevation = 175;
    const fixture = createGeometrySnapshotFixture(project.id, project.revision);
    const fixtureLevel = fixture.geometry.levels[0]!;
    const fixturePolygon = fixtureLevel.polygons[0]!;
    const snapshot = {
      ...fixture.geometry,
      levels: [{
        ...fixtureLevel,
        sourceLevelId: level.id,
        polygons: [{
          ...fixturePolygon,
          sourceRoomId: room.id,
          floorElevation: 175
        }]
      }]
    };

    const localFloor = createArchitecturalScene3DModel(project).levels[0]!.floors
      .find((floor) => floor.roomId === room.id)!;
    const snapshotFloor = createArchitecturalScene3DModel(project, snapshot).levels[0]!.floors[0]!;

    expect(localFloor.y).toBe(1.75);
    expect(snapshotFloor.y).toBe(localFloor.y);
  });

  it("keeps overlapping lower and elevated floor surfaces at independent Y elevations", () => {
    const project = structuredClone(demoProjectFixture);
    const level = project.building.levels[0]!;
    const lowerRoom = level.rooms[0]!;
    level.rooms.push({
      id: "elevated-overlay",
      name: "Elevated Overlay",
      type: "STUDIO",
      elevation: 450,
      boundary: [
        { kind: "FREE", start: { x: 100, z: 50 }, end: { x: 300, z: 50 } },
        { kind: "FREE", start: { x: 300, z: 50 }, end: { x: 300, z: 250 } },
        { kind: "FREE", start: { x: 300, z: 250 }, end: { x: 100, z: 250 } },
        { kind: "FREE", start: { x: 100, z: 250 }, end: { x: 100, z: 50 } }
      ]
    });

    const model = createArchitecturalScene3DModel(project);
    const lowerFloor = model.levels[0]!.floors.find((floor) => floor.roomId === lowerRoom.id)!;
    const elevatedFloor = model.levels[0]!.floors.find((floor) => floor.roomId === "elevated-overlay")!;

    expect(lowerFloor.y).toBe(0);
    expect(elevatedFloor.y).toBe(4.5);
    expect(lowerFloor.contour).toEqual([
      { x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: -3 }, { x: 0, z: -3 }
    ]);
    expect(elevatedFloor.contour).toEqual([
      { x: 1, z: -0.5 }, { x: 3, z: -0.5 }, { x: 3, z: -2.5 }, { x: 1, z: -2.5 }
    ]);
    expect(model.bounds?.max.y).toBe(4.5);
    expect(model).not.toHaveProperty("supports");
    expect(model).not.toHaveProperty("railings");
    expect(model.levels[0]).not.toHaveProperty("slabs");
  });

  it("includes elevated Floor Y in scene bounds alongside empty canonical Stair aggregates", () => {
    const project = structuredClone(demoProjectFixture);
    project.building.levels[0]!.rooms[0]!.elevation = 450;
    project.building.levels[0]!.staircases = [{
      id: "draft-stair",
      fromLevelId: project.building.levels[0]!.id,
      toLevelId: project.building.levels[0]!.id,
      width: 90,
      flights: [],
      landings: []
    }];

    const model = createArchitecturalScene3DModel(project);

    expect(model.bounds?.max.y).toBe(4.5);
    expect(model).not.toHaveProperty("staircases");
    expect(model.levels[0]?.staircases[0]?.flights).toEqual([]);
  });

  it("triangulates irregular and concave contours to their exact polygon area", () => {
    const irregular = [
      { x: 0, z: 0 }, { x: 5, z: 0 }, { x: 6, z: 2 },
      { x: 3, z: 4 }, { x: 0, z: 3 }
    ];
    const concave = [
      { x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 1 },
      { x: 2, z: 1 }, { x: 2, z: 3 }, { x: 0, z: 3 }
    ];

    expect(triangulatedArea(irregular, triangulateFloorContour3D(irregular)))
      .toBeCloseTo(Math.abs(polygonArea(irregular)));
    expect(triangulatedArea(concave, triangulateFloorContour3D(concave)))
      .toBeCloseTo(Math.abs(polygonArea(concave)));
    expect(triangulateFloorContour3D(concave)).toHaveLength(4);
  });

  it("does not substitute a concave Room contour with its AABB", () => {
    const project = createConcaveRoomProject();
    const floor = createArchitecturalScene3DModel(project).levels[0]!.floors[0]!;

    expect(floor.contour).toHaveLength(6);
    expect(Math.abs(polygonArea(floor.contour))).toBe(8);
    expect((4 - 0) * (3 - 0)).toBe(12);
    expect(triangulatedArea(floor.contour, floor.triangles)).toBeCloseTo(8);
  });
});

function createWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: "wall",
    start: { x: 0, z: 0 },
    end: { x: 400, z: 0 },
    height: 300,
    thickness: 20,
    roomIds: [],
    openings: [],
    ...overrides
  };
}

function opening(overrides: Partial<Opening3D> = {}): Opening3D {
  return {
    id: "window",
    kind: "WINDOW",
    offsetFromStart: 2,
    width: 1,
    elevation: 1,
    height: 1,
    ...overrides
  };
}

function isSolidAt(
  sections: readonly WallSection3D[],
  along: number,
  vertical: number
): boolean {
  return sections.some((section) =>
    along >= section.start && along <= section.end &&
    vertical >= section.bottom && vertical <= section.top
  );
}

function createWallOnlyProject(wall: Wall, elevation = 0): Project {
  const project = structuredClone(demoProjectFixture);
  project.building.levels = [{
    ...project.building.levels[0]!,
    elevation,
    rooms: [],
    walls: [wall],
    staircases: []
  }];
  return project;
}

function openingWorldEndpoints(wall: ReturnType<typeof createWall3D>) {
  const wallOpening = wall.openings[0]!;
  return [
    wallOpening.offsetFromStart,
    wallOpening.offsetFromStart + wallOpening.width
  ].map((along) => ({
    x: wall.origin.x + wall.u.x * along,
    z: wall.origin.z + wall.u.z * along
  }));
}

function polygonArea(points: readonly ScenePlanVector3D[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return area + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

function triangulatedArea(
  points: readonly ScenePlanVector3D[],
  triangles: readonly (readonly [number, number, number])[]
): number {
  return triangles.reduce((area, triangle) => area + Math.abs(polygonArea(
    triangle.map((index) => points[index]!)
  )), 0);
}

function createConcaveRoomProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const points = [
    { x: 0, z: 0 },
    { x: 400, z: 0 },
    { x: 400, z: 100 },
    { x: 200, z: 100 },
    { x: 200, z: 300 },
    { x: 0, z: 300 }
  ];
  const walls = points.map<Wall>((start, index) => ({
    id: `concave-wall-${index}`,
    start,
    end: points[(index + 1) % points.length]!,
    height: 300,
    thickness: 20,
    roomIds: ["concave-room"],
    openings: []
  }));
  project.building.levels = [{
    ...project.building.levels[0]!,
    rooms: [{
      id: "concave-room",
      name: "Concave Room",
      type: "LIVING_ROOM",
      boundary: walls.map((wall) => ({ wallId: wall.id, direction: "FORWARD" }))
    }],
    walls,
    staircases: []
  }];
  return project;
}

function createMultiLevelProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const ground = project.building.levels[0]!;
  project.building.levels = [
    { ...structuredClone(ground), id: "level-lower", name: "Lower", elevation: -50 },
    { ...structuredClone(ground), id: "level-ground", name: "Ground", elevation: 0 },
    { ...structuredClone(ground), id: "level-upper", name: "Upper", elevation: 320 }
  ];
  return project;
}

function createAsymmetricProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const points = [
    { x: 0, z: -400 },
    { x: 600, z: -400 },
    { x: 600, z: -100 },
    { x: 400, z: -100 },
    { x: 400, z: 0 },
    { x: 0, z: 0 }
  ];
  project.building.levels = [{
    ...project.building.levels[0]!,
    elevation: 275,
    rooms: [],
    staircases: [],
    walls: points.map((start, index) => ({
      id: `asymmetric-wall-${index}`,
      start,
      end: points[(index + 1) % points.length]!,
      height: 280,
      thickness: 18,
      roomIds: [],
      openings: []
    }))
  }];
  return project;
}

function signedArea(points: readonly { readonly x: number; readonly z: number }[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return area + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

function expectSolidTrianglesFaceAwayFrom(
  positions: readonly number[],
  interior: Readonly<{ x: number; y: number; z: number }>
): void {
  for (let index = 0; index < positions.length; index += 9) {
    const a = { x: positions[index]!, y: positions[index + 1]!, z: positions[index + 2]! };
    const b = { x: positions[index + 3]!, y: positions[index + 4]!, z: positions[index + 5]! };
    const c = { x: positions[index + 6]!, y: positions[index + 7]!, z: positions[index + 8]! };
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const normal = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };
    const centroid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3,
      z: (a.z + b.z + c.z) / 3
    };
    expect(
      normal.x * (centroid.x - interior.x) +
      normal.y * (centroid.y - interior.y) +
      normal.z * (centroid.z - interior.z)
    ).toBeGreaterThan(0);
  }
}
