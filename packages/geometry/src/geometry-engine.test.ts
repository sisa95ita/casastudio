import { ProjectSchema, type Project } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import {
  type BoundingBox,
  GeometryBuildErrorCode,
  GeometryEngine,
  type PolygonWinding,
  type BoundaryEdge,
  type BoundaryEdgeUse,
  type GeometryBuildResult,
  type GeometryModel,
  type LevelGeometry,
  type Loop,
  type Polygon,
  type Vertex
} from "./index.js";

type RectangleFixtureOptions = {
  readonly clockwise?: boolean;
};

const buildRectangularRoomProject = ({
  clockwise = false
}: RectangleFixtureOptions = {}): Project =>
  ProjectSchema.parse({
    id: "geometry-slice-project",
    name: "Geometry Slice Project",
    schemaVersion: "2.0.0",
    revision: 7,
    createdAt: "2026-07-20T10:00:00+02:00",
    updatedAt: "2026-07-20T10:00:00+02:00",
    units: {
      length: "cm",
      angle: "deg"
    },
    building: {
      id: "main-building",
      name: "Main Building",
      type: "HOUSE",
      levels: [
        {
          id: "ground-level",
          name: "Ground Level",
          elevation: 0,
          rooms: [
            {
              id: "living-room",
              name: "Living Room",
              type: "LIVING_ROOM",
              boundary: clockwise
                ? [
                    { wallId: "west-wall", direction: "REVERSE" },
                    { wallId: "south-wall", direction: "FORWARD" },
                    { wallId: "east-wall", direction: "REVERSE" },
                    { wallId: "north-wall", direction: "REVERSE" }
                  ]
                : [
                    { wallId: "north-wall", direction: "FORWARD" },
                    { wallId: "east-wall", direction: "FORWARD" },
                    { wallId: "south-wall", direction: "REVERSE" },
                    { wallId: "west-wall", direction: "FORWARD" }
                  ]
            }
          ],
          walls: [
            {
              id: "north-wall",
              start: { x: 0, z: 0 },
              end: { x: 400, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            },
            {
              id: "east-wall",
              start: { x: 400, z: 0 },
              end: { x: 400, z: 300 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            },
            {
              id: "south-wall",
              start: { x: 0, z: 300 },
              end: { x: 400, z: 300 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            },
            {
              id: "west-wall",
              start: { x: 0, z: 300 },
              end: { x: 0, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            }
          ],
          staircases: []
        }
      ]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  });

const buildDegenerateRoomProject = (): Project =>
  ProjectSchema.parse({
    id: "degenerate-room-project",
    name: "Degenerate Room Project",
    schemaVersion: "2.0.0",
    revision: 2,
    createdAt: "2026-07-20T10:00:00+02:00",
    updatedAt: "2026-07-20T10:00:00+02:00",
    units: {
      length: "cm",
      angle: "deg"
    },
    building: {
      id: "main-building",
      name: "Main Building",
      type: "HOUSE",
      levels: [
        {
          id: "ground-level",
          name: "Ground Level",
          elevation: 0,
          rooms: [
            {
              id: "line-room",
              name: "Line Room",
              type: "OTHER",
              boundary: [
                { wallId: "line-a", direction: "FORWARD" },
                { wallId: "line-b", direction: "FORWARD" },
                { wallId: "line-c", direction: "FORWARD" },
                { wallId: "line-d", direction: "FORWARD" }
              ]
            }
          ],
          walls: [
            {
              id: "line-a",
              start: { x: 0, z: 0 },
              end: { x: 100, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["line-room"],
              openings: []
            },
            {
              id: "line-b",
              start: { x: 100, z: 0 },
              end: { x: 200, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["line-room"],
              openings: []
            },
            {
              id: "line-c",
              start: { x: 200, z: 0 },
              end: { x: 100, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["line-room"],
              openings: []
            },
            {
              id: "line-d",
              start: { x: 100, z: 0 },
              end: { x: 0, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["line-room"],
              openings: []
            }
          ],
          staircases: []
        }
      ]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  });

const buildEmptyLevelProject = (): Project =>
  ProjectSchema.parse({
    id: "empty-level-project",
    name: "Empty Level Project",
    schemaVersion: "2.0.0",
    revision: 1,
    createdAt: "2026-07-20T10:00:00+02:00",
    updatedAt: "2026-07-20T10:00:00+02:00",
    units: {
      length: "cm",
      angle: "deg"
    },
    building: {
      id: "main-building",
      name: "Main Building",
      type: "HOUSE",
      levels: [
        {
          id: "draft-level",
          name: "Draft Level",
          elevation: 120,
          rooms: [],
          walls: [],
          staircases: []
        }
      ]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  });

const buildSharedWallProject = (): Project =>
  ProjectSchema.parse({
    id: "shared-wall-project",
    name: "Shared Wall Project",
    schemaVersion: "2.0.0",
    revision: 3,
    createdAt: "2026-07-20T10:00:00+02:00",
    updatedAt: "2026-07-20T10:00:00+02:00",
    units: {
      length: "cm",
      angle: "deg"
    },
    building: {
      id: "main-building",
      name: "Main Building",
      type: "HOUSE",
      levels: [
        {
          id: "ground-level",
          name: "Ground Level",
          elevation: 0,
          rooms: [
            {
              id: "room-a",
              name: "Room A",
              type: "OTHER",
              boundary: [
                { wallId: "room-a-south-wall", direction: "FORWARD" },
                { wallId: "shared-wall", direction: "FORWARD" },
                { wallId: "room-a-north-wall", direction: "REVERSE" },
                { wallId: "room-a-west-wall", direction: "FORWARD" }
              ]
            },
            {
              id: "room-b",
              name: "Room B",
              type: "OTHER",
              boundary: [
                { wallId: "room-b-south-wall", direction: "FORWARD" },
                { wallId: "room-b-east-wall", direction: "FORWARD" },
                { wallId: "room-b-north-wall", direction: "REVERSE" },
                { wallId: "shared-wall", direction: "REVERSE" }
              ]
            }
          ],
          walls: [
            {
              id: "room-a-south-wall",
              start: { x: 0, z: 0 },
              end: { x: 5, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["room-a"],
              openings: []
            },
            {
              id: "shared-wall",
              start: { x: 5, z: 0 },
              end: { x: 5, z: 5 },
              height: 300,
              thickness: 20,
              roomIds: ["room-a", "room-b"],
              openings: []
            },
            {
              id: "room-a-north-wall",
              start: { x: 0, z: 5 },
              end: { x: 5, z: 5 },
              height: 300,
              thickness: 20,
              roomIds: ["room-a"],
              openings: []
            },
            {
              id: "room-a-west-wall",
              start: { x: 0, z: 5 },
              end: { x: 0, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["room-a"],
              openings: []
            },
            {
              id: "room-b-south-wall",
              start: { x: 5, z: 0 },
              end: { x: 10, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["room-b"],
              openings: []
            },
            {
              id: "room-b-east-wall",
              start: { x: 10, z: 0 },
              end: { x: 10, z: 5 },
              height: 300,
              thickness: 20,
              roomIds: ["room-b"],
              openings: []
            },
            {
              id: "room-b-north-wall",
              start: { x: 5, z: 5 },
              end: { x: 10, z: 5 },
              height: 300,
              thickness: 20,
              roomIds: ["room-b"],
              openings: []
            }
          ],
          staircases: []
        }
      ]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  });

const buildNonManifoldSharedWallProject = (): Project => {
  const project = buildSharedWallProject();
  const level = project.building.levels[0];

  if (!level) {
    throw new Error("Expected shared-wall fixture to contain one level.");
  }

  level.rooms.push({
    id: "room-c",
    name: "Room C",
    type: "OTHER",
    boundary: [
      { wallId: "room-a-south-wall", direction: "FORWARD" },
      { wallId: "shared-wall", direction: "FORWARD" },
      { wallId: "room-a-north-wall", direction: "REVERSE" },
      { wallId: "room-a-west-wall", direction: "FORWARD" }
    ]
  });

  return project;
};

const expectOk = (result: GeometryBuildResult): GeometryModel => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected geometry build to succeed.");
  }

  return result.model;
};

const getRectangularLevel = (model: GeometryModel): LevelGeometry => {
  const level = model.levels[0];
  expect(level).toBeDefined();
  return level as LevelGeometry;
};

const getOnlyPolygon = (level: LevelGeometry): Polygon => {
  const polygon = level.polygons[0];
  expect(polygon).toBeDefined();
  return polygon as Polygon;
};

const findPolygonBySourceRoomId = (
  level: LevelGeometry,
  sourceRoomId: string
): Polygon => {
  const polygon = level.polygons.find(
    (candidate) => candidate.sourceRoomId === sourceRoomId
  );
  expect(polygon).toBeDefined();
  return polygon as Polygon;
};

const findEdgeUseBySourceWallId = (
  polygon: Polygon,
  sourceWallId: string
): BoundaryEdgeUse => {
  const edgeUse = polygon.edgeUses.find(
    (candidate) => candidate.boundaryEdge.sourceWallId === sourceWallId
  );
  expect(edgeUse).toBeDefined();
  return edgeUse as BoundaryEdgeUse;
};

describe("GeometryEngine", () => {
  it("exports a static build API returning the build-result contract", () => {
    const result = GeometryEngine.build(buildEmptyLevelProject());

    expect(result.ok).toBe(true);
    expect(result).toHaveProperty("model");
  });

  it("builds empty level geometry for a canonical draft level with no geometric rooms", () => {
    const model = expectOk(GeometryEngine.build(buildEmptyLevelProject()));
    const level = getRectangularLevel(model);

    expect(model.sourceRevision).toBe(1);
    expect(level.id).toBe("level:draft-level");
    expect(level.sourceLevelId).toBe("draft-level");
    expect(level.elevation).toBe(120);
    expect(level.vertices).toEqual([]);
    expect(level.boundaryEdges).toEqual([]);
    expect(level.boundaryEdgeUses).toEqual([]);
    expect(level.loops).toEqual([]);
    expect(level.polygons).toEqual([]);
  });

  it("emits standalone Walls before they are referenced by a Room", () => {
    const project = buildRectangularRoomProject();
    project.building.levels[0]!.walls.push({
      id: "standalone-wall",
      start: { x: 40, z: 40 },
      end: { x: 160, z: 90 },
      height: 300,
      thickness: 20,
      roomIds: [],
      openings: []
    });

    const level = getRectangularLevel(expectOk(GeometryEngine.build(project)));
    const edge = level.boundaryEdges.find(
      (candidate) => candidate.sourceWallId === "standalone-wall"
    );

    expect(edge).toBeDefined();
    expect(edge?.startVertex).toMatchObject({ x: 40, z: 40 });
    expect(edge?.endVertex).toMatchObject({ x: 160, z: 90 });
    expect(level.boundaryEdgeUses).toHaveLength(4);
    expect(level.polygons).toHaveLength(1);
  });

  it("builds one rectangular room into deterministic level topology", () => {
    const model = expectOk(GeometryEngine.build(buildRectangularRoomProject()));
    const level = getRectangularLevel(model);
    const polygon = getOnlyPolygon(level);

    expect(model.id).toBe("geometry-model:geometry-slice-project:7");
    expect(model.sourceProjectId).toBe("geometry-slice-project");
    expect(model.sourceRevision).toBe(7);
    expect(model.levels).toHaveLength(1);
    expect(level.sourceLevelId).toBe("ground-level");
    expect(level.elevation).toBe(0);
    expect(level.vertices).toHaveLength(4);
    expect(level.boundaryEdges).toHaveLength(4);
    expect(level.boundaryEdgeUses).toHaveLength(4);
    expect(level.loops).toHaveLength(1);
    expect(level.polygons).toHaveLength(1);

    expect(polygon.id).toBe("polygon:living-room");
    expect(polygon.sourceRoomId).toBe("living-room");
    expect(polygon.outerLoop).toBe(level.loops[0]);
    expect(polygon.innerLoops).toEqual([]);
  });

  it("derives polygon metrics from counter-clockwise runtime vertex order", () => {
    const polygon = getOnlyPolygon(
      getRectangularLevel(
        expectOk(GeometryEngine.build(buildRectangularRoomProject()))
      )
    );
    const expectedBounds: BoundingBox = {
      minX: 0,
      minZ: 0,
      maxX: 400,
      maxZ: 300
    };
    const expectedWinding: PolygonWinding = "COUNTER_CLOCKWISE";

    expect(polygon.signedArea).toBe(120000);
    expect(polygon.area).toBe(120000);
    expect(polygon.winding).toBe(expectedWinding);
    expect(polygon.bounds).toEqual(expectedBounds);
    expect(polygon.centroid).toEqual({ x: 200, z: 150 });
  });

  it("derives clockwise polygon winding and preserves signed area without normalization", () => {
    const polygon = getOnlyPolygon(
      getRectangularLevel(
        expectOk(
          GeometryEngine.build(buildRectangularRoomProject({ clockwise: true }))
        )
      )
    );

    expect(polygon.vertices.map((vertex) => vertex.id)).toEqual([
      "vertex:ground-level:0:0",
      "vertex:ground-level:0:300",
      "vertex:ground-level:400:300",
      "vertex:ground-level:400:0"
    ]);
    expect(polygon.signedArea).toBe(-120000);
    expect(polygon.area).toBe(120000);
    expect(polygon.winding).toBe("CLOCKWISE");
    expect(polygon.bounds).toEqual({
      minX: 0,
      minZ: 0,
      maxX: 400,
      maxZ: 300
    });
    expect(polygon.centroid).toEqual({ x: 200, z: 150 });
  });

  it("preserves persisted room-boundary order and traversal relationships", () => {
    const level = getRectangularLevel(
      expectOk(GeometryEngine.build(buildRectangularRoomProject()))
    );
    const polygon = getOnlyPolygon(level);
    const loop = polygon.outerLoop;
    const [northUse, eastUse, southUse, westUse] = loop.edgeUses as [
      BoundaryEdgeUse,
      BoundaryEdgeUse,
      BoundaryEdgeUse,
      BoundaryEdgeUse
    ];
    const [northEdge, eastEdge, southEdge, westEdge] = level.boundaryEdges as [
      BoundaryEdge,
      BoundaryEdge,
      BoundaryEdge,
      BoundaryEdge
    ];

    expect(loop.kind).toBe("OUTER");
    expect(loop.polygon).toBe(polygon);
    expect(loop.edgeUses).toEqual([northUse, eastUse, southUse, westUse]);
    expect(
      [northUse, eastUse, southUse, westUse].map((edgeUse) => edgeUse.index)
    ).toEqual([0, 1, 2, 3]);
    expect(
      [northUse, eastUse, southUse, westUse].map((edgeUse) => edgeUse.loop)
    ).toEqual([loop, loop, loop, loop]);
    expect(
      [northUse, eastUse, southUse, westUse].map(
        (edgeUse) => edgeUse.boundaryEdge
      )
    ).toEqual([northEdge, eastEdge, southEdge, westEdge]);
    expect(
      [northEdge, eastEdge, southEdge, westEdge].map(
        (edge) => edge.sourceWallId
      )
    ).toEqual(["north-wall", "east-wall", "south-wall", "west-wall"]);
    expect(
      [northUse, eastUse, southUse, westUse].map((edgeUse) => edgeUse.direction)
    ).toEqual(["FORWARD", "FORWARD", "REVERSE", "FORWARD"]);
    expect(northUse.startVertex).toBe(northEdge.startVertex);
    expect(northUse.endVertex).toBe(northEdge.endVertex);
    expect(southUse.startVertex).toBe(southEdge.endVertex);
    expect(southUse.endVertex).toBe(southEdge.startVertex);
  });

  it("builds two rectangular rooms that share one physical boundary edge", () => {
    const level = getRectangularLevel(
      expectOk(GeometryEngine.build(buildSharedWallProject()))
    );
    const roomA = findPolygonBySourceRoomId(level, "room-a");
    const roomB = findPolygonBySourceRoomId(level, "room-b");
    const sharedEdge = level.boundaryEdges.find(
      (edge) => edge.sourceWallId === "shared-wall"
    );

    expect(level.polygons).toHaveLength(2);
    expect(level.loops).toHaveLength(2);
    expect(level.boundaryEdges).toHaveLength(7);
    expect(level.boundaryEdgeUses).toHaveLength(8);
    expect(sharedEdge).toBeDefined();
    expect(roomA.area).toBe(25);
    expect(roomB.area).toBe(25);
    expect(roomA.winding).toBe("COUNTER_CLOCKWISE");
    expect(roomB.winding).toBe("COUNTER_CLOCKWISE");
  });

  it("reuses the same shared BoundaryEdge object across room-specific edge uses", () => {
    const level = getRectangularLevel(
      expectOk(GeometryEngine.build(buildSharedWallProject()))
    );
    const roomA = findPolygonBySourceRoomId(level, "room-a");
    const roomB = findPolygonBySourceRoomId(level, "room-b");
    const roomASharedUse = findEdgeUseBySourceWallId(roomA, "shared-wall");
    const roomBSharedUse = findEdgeUseBySourceWallId(roomB, "shared-wall");

    expect(roomASharedUse).not.toBe(roomBSharedUse);
    expect(roomASharedUse.boundaryEdge).toBe(roomBSharedUse.boundaryEdge);
    expect(roomASharedUse.boundaryEdge.id).toBe("boundary-edge:shared-wall");
    expect(roomASharedUse.loop).toBe(roomA.outerLoop);
    expect(roomBSharedUse.loop).toBe(roomB.outerLoop);
  });

  it("preserves opposite traversal directions for shared boundary edge uses", () => {
    const level = getRectangularLevel(
      expectOk(GeometryEngine.build(buildSharedWallProject()))
    );
    const roomA = findPolygonBySourceRoomId(level, "room-a");
    const roomB = findPolygonBySourceRoomId(level, "room-b");
    const roomASharedUse = findEdgeUseBySourceWallId(roomA, "shared-wall");
    const roomBSharedUse = findEdgeUseBySourceWallId(roomB, "shared-wall");
    const sharedEdge = roomASharedUse.boundaryEdge;

    expect(roomASharedUse.direction).toBe("FORWARD");
    expect(roomBSharedUse.direction).toBe("REVERSE");
    expect(roomASharedUse.startVertex).toBe(sharedEdge.startVertex);
    expect(roomASharedUse.endVertex).toBe(sharedEdge.endVertex);
    expect(roomBSharedUse.startVertex).toBe(sharedEdge.endVertex);
    expect(roomBSharedUse.endVertex).toBe(sharedEdge.startVertex);
  });

  it("deduplicates level-local vertices by exact XZ coordinate equality", () => {
    const level = getRectangularLevel(
      expectOk(GeometryEngine.build(buildRectangularRoomProject()))
    );
    const [northEdge, eastEdge, southEdge, westEdge] = level.boundaryEdges as [
      BoundaryEdge,
      BoundaryEdge,
      BoundaryEdge,
      BoundaryEdge
    ];
    const uniqueVertices = new Set<Vertex>([
      northEdge.startVertex,
      northEdge.endVertex,
      eastEdge.startVertex,
      eastEdge.endVertex,
      southEdge.startVertex,
      southEdge.endVertex,
      westEdge.startVertex,
      westEdge.endVertex
    ]);

    expect(level.vertices).toHaveLength(4);
    expect(uniqueVertices.size).toBe(4);
    expect(northEdge.endVertex).toBe(eastEdge.startVertex);
    expect(eastEdge.endVertex).toBe(southEdge.endVertex);
    expect(southEdge.startVertex).toBe(westEdge.startVertex);
    expect(westEdge.endVertex).toBe(northEdge.startVertex);
  });

  it("produces deterministic runtime identifiers for identical source input", () => {
    const first = getRectangularLevel(
      expectOk(GeometryEngine.build(buildRectangularRoomProject()))
    );
    const second = getRectangularLevel(
      expectOk(GeometryEngine.build(buildRectangularRoomProject()))
    );

    expect(second.id).toBe(first.id);
    expect(second.vertices.map((vertex) => vertex.id)).toEqual(
      first.vertices.map((vertex) => vertex.id)
    );
    expect(second.boundaryEdges.map((edge) => edge.id)).toEqual(
      first.boundaryEdges.map((edge) => edge.id)
    );
    expect(second.boundaryEdgeUses.map((edgeUse) => edgeUse.id)).toEqual(
      first.boundaryEdgeUses.map((edgeUse) => edgeUse.id)
    );
    expect(second.loops.map((loop) => loop.id)).toEqual(
      first.loops.map((loop) => loop.id)
    );
    expect(second.polygons.map((polygon) => polygon.id)).toEqual(
      first.polygons.map((polygon) => polygon.id)
    );
    expect(
      second.polygons.map((polygon) =>
        polygon.vertices.map((vertex) => vertex.id)
      )
    ).toEqual(
      first.polygons.map((polygon) =>
        polygon.vertices.map((vertex) => vertex.id)
      )
    );
    expect(second.polygons.map((polygon) => polygon.signedArea)).toEqual(
      first.polygons.map((polygon) => polygon.signedArea)
    );
    expect(second.polygons.map((polygon) => polygon.area)).toEqual(
      first.polygons.map((polygon) => polygon.area)
    );
    expect(second.polygons.map((polygon) => polygon.winding)).toEqual(
      first.polygons.map((polygon) => polygon.winding)
    );
    expect(second.polygons.map((polygon) => polygon.bounds)).toEqual(
      first.polygons.map((polygon) => polygon.bounds)
    );
    expect(second.polygons.map((polygon) => polygon.centroid)).toEqual(
      first.polygons.map((polygon) => polygon.centroid)
    );
  });

  it("produces deterministic shared-edge relationships for identical source input", () => {
    const first = getRectangularLevel(
      expectOk(GeometryEngine.build(buildSharedWallProject()))
    );
    const second = getRectangularLevel(
      expectOk(GeometryEngine.build(buildSharedWallProject()))
    );
    const firstRoomA = findPolygonBySourceRoomId(first, "room-a");
    const firstRoomB = findPolygonBySourceRoomId(first, "room-b");
    const secondRoomA = findPolygonBySourceRoomId(second, "room-a");
    const secondRoomB = findPolygonBySourceRoomId(second, "room-b");
    const firstSharedUses = [
      findEdgeUseBySourceWallId(firstRoomA, "shared-wall"),
      findEdgeUseBySourceWallId(firstRoomB, "shared-wall")
    ];
    const secondSharedUses = [
      findEdgeUseBySourceWallId(secondRoomA, "shared-wall"),
      findEdgeUseBySourceWallId(secondRoomB, "shared-wall")
    ];

    expect(second.boundaryEdges.map((edge) => edge.id)).toEqual(
      first.boundaryEdges.map((edge) => edge.id)
    );
    expect(second.polygons.map((polygon) => polygon.id)).toEqual(
      first.polygons.map((polygon) => polygon.id)
    );
    expect(secondSharedUses.map((edgeUse) => edgeUse.id)).toEqual(
      firstSharedUses.map((edgeUse) => edgeUse.id)
    );
    expect(secondSharedUses.map((edgeUse) => edgeUse.direction)).toEqual(
      firstSharedUses.map((edgeUse) => edgeUse.direction)
    );
    expect(secondSharedUses.map((edgeUse) => edgeUse.boundaryEdge.id)).toEqual(
      firstSharedUses.map((edgeUse) => edgeUse.boundaryEdge.id)
    );
    expect(secondSharedUses.map((edgeUse) => edgeUse.loop.polygon.id)).toEqual(
      firstSharedUses.map((edgeUse) => edgeUse.loop.polygon.id)
    );
  });

  it("exposes immutable runtime collections and does not alias source arrays", () => {
    const project = buildRectangularRoomProject();
    const model = expectOk(GeometryEngine.build(project));
    const level = getRectangularLevel(model);

    project.building.levels[0]?.rooms.splice(0);

    expect(level.polygons).toHaveLength(1);
    expect(() => (model.levels as LevelGeometry[]).push(level)).toThrow(
      TypeError
    );
    expect(() =>
      (level.vertices as Vertex[]).push(level.vertices[0] as Vertex)
    ).toThrow(TypeError);
    expect(() =>
      (getOnlyPolygon(level).innerLoops as Loop[]).push(
        getOnlyPolygon(level).outerLoop
      )
    ).toThrow(TypeError);
    expect(
      () => ((getOnlyPolygon(level).bounds as { minX: number }).minX = -1)
    ).toThrow(TypeError);
    expect(
      () => ((getOnlyPolygon(level).centroid as { x: number }).x = -1)
    ).toThrow(TypeError);
  });

  it("returns geometry build errors instead of throwing for missing source entities", () => {
    const project = buildRectangularRoomProject();
    project.building.levels[0]?.walls.pop();

    const result = GeometryEngine.build(project);

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: GeometryBuildErrorCode.MISSING_SOURCE_ENTITY,
          message:
            'Room "living-room" boundary references missing wall "west-wall".',
          path: "building.levels[0].rooms[0].boundary[3].wallId",
          sourceId: "west-wall"
        }
      ]
    });
  });

  it("returns an invalid geometry build result for degenerate polygons instead of inventing metrics", () => {
    const result = GeometryEngine.build(buildDegenerateRoomProject());

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: 'Room "line-room" boundary produces a zero-area polygon.',
          path: "building.levels[0].rooms[0].boundary",
          sourceId: "line-room"
        }
      ]
    });
  });

  it("returns a build error when a physical boundary edge has more than two room uses", () => {
    const result = GeometryEngine.build(buildNonManifoldSharedWallProject());

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: GeometryBuildErrorCode.NON_MANIFOLD_BOUNDARY_EDGE,
          message:
            'Boundary edge "shared-wall" is used by 3 room boundaries, but at most 2 are supported.',
          path: "building.levels[0].walls[1]",
          sourceId: "shared-wall"
        }
      ]
    });
  });
});
