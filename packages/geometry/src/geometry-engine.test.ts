import { ProjectSchema, type Project } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import {
  GeometryBuildErrorCode,
  GeometryEngine,
  type BoundaryEdge,
  type BoundaryEdgeUse,
  type GeometryBuildResult,
  type GeometryModel,
  type LevelGeometry,
  type Loop,
  type Polygon,
  type Vertex
} from "./index";

const buildRectangularRoomProject = (): Project =>
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
              boundary: [
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

  it("preserves persisted room-boundary order and traversal relationships", () => {
    const level = getRectangularLevel(expectOk(GeometryEngine.build(buildRectangularRoomProject())));
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
    expect([northUse, eastUse, southUse, westUse].map((edgeUse) => edgeUse.index)).toEqual([0, 1, 2, 3]);
    expect([northUse, eastUse, southUse, westUse].map((edgeUse) => edgeUse.loop)).toEqual([
      loop,
      loop,
      loop,
      loop
    ]);
    expect([northUse, eastUse, southUse, westUse].map((edgeUse) => edgeUse.boundaryEdge)).toEqual([
      northEdge,
      eastEdge,
      southEdge,
      westEdge
    ]);
    expect([northEdge, eastEdge, southEdge, westEdge].map((edge) => edge.sourceWallId)).toEqual([
      "north-wall",
      "east-wall",
      "south-wall",
      "west-wall"
    ]);
    expect([northUse, eastUse, southUse, westUse].map((edgeUse) => edgeUse.direction)).toEqual([
      "FORWARD",
      "FORWARD",
      "REVERSE",
      "FORWARD"
    ]);
    expect(northUse.startVertex).toBe(northEdge.startVertex);
    expect(northUse.endVertex).toBe(northEdge.endVertex);
    expect(southUse.startVertex).toBe(southEdge.endVertex);
    expect(southUse.endVertex).toBe(southEdge.startVertex);
  });

  it("deduplicates level-local vertices by exact XZ coordinate equality", () => {
    const level = getRectangularLevel(expectOk(GeometryEngine.build(buildRectangularRoomProject())));
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
    const first = getRectangularLevel(expectOk(GeometryEngine.build(buildRectangularRoomProject())));
    const second = getRectangularLevel(expectOk(GeometryEngine.build(buildRectangularRoomProject())));

    expect(second.id).toBe(first.id);
    expect(second.vertices.map((vertex) => vertex.id)).toEqual(first.vertices.map((vertex) => vertex.id));
    expect(second.boundaryEdges.map((edge) => edge.id)).toEqual(first.boundaryEdges.map((edge) => edge.id));
    expect(second.boundaryEdgeUses.map((edgeUse) => edgeUse.id)).toEqual(
      first.boundaryEdgeUses.map((edgeUse) => edgeUse.id)
    );
    expect(second.loops.map((loop) => loop.id)).toEqual(first.loops.map((loop) => loop.id));
    expect(second.polygons.map((polygon) => polygon.id)).toEqual(first.polygons.map((polygon) => polygon.id));
  });

  it("exposes immutable runtime collections and does not alias source arrays", () => {
    const project = buildRectangularRoomProject();
    const model = expectOk(GeometryEngine.build(project));
    const level = getRectangularLevel(model);

    project.building.levels[0]?.rooms.splice(0);

    expect(level.polygons).toHaveLength(1);
    expect(() => (model.levels as LevelGeometry[]).push(level)).toThrow(TypeError);
    expect(() => (level.vertices as Vertex[]).push(level.vertices[0] as Vertex)).toThrow(TypeError);
    expect(() => (getOnlyPolygon(level).innerLoops as Loop[]).push(getOnlyPolygon(level).outerLoop)).toThrow(TypeError);
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
          message: 'Room "living-room" boundary references missing wall "west-wall".',
          path: "building.levels[0].rooms[0].boundary[3].wallId",
          sourceId: "west-wall"
        }
      ]
    });
  });
});
