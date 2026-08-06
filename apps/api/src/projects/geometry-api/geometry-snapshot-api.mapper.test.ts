import {
  GeometryEngine,
  GeometryModel,
  LevelGeometry,
  Vertex
} from "@casastudio/geometry";
import { ProjectSchema, type Project } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { GeometrySnapshotApiMapper, GeometrySnapshotSerializationInvariantError } from "./geometry-snapshot-api.mapper";

describe("GeometrySnapshotApiMapper", () => {
  it("maps Geometry Engine output into a fresh deterministic DTO snapshot", () => {
    const project = buildRectangularRoomProject();
    const model = expectModel(GeometryEngine.build(project));
    const response = new GeometrySnapshotApiMapper().toProjectGeometryResponse(project, model);
    const level = response.geometry.levels[0];
    const polygon = level?.polygons[0];
    const loop = level?.loops[0];

    expect(response.sourceProjectId).toBe(project.id);
    expect(response.sourceRevision).toBe(project.revision);
    expect(response.geometry.id).toBe("geometry-model:geometry-slice-project:7");
    expect(response.geometry.units).toEqual({ length: "cm", angle: "deg" });
    expect(level).toMatchObject({
      id: "level:ground-level",
      sourceLevelId: "ground-level",
      elevation: 0
    });
    expect(level?.vertices.map((vertex) => vertex.id)).toEqual([
      "vertex:ground-level:0:0",
      "vertex:ground-level:400:0",
      "vertex:ground-level:400:300",
      "vertex:ground-level:0:300"
    ]);
    expect(level?.boundaryEdges.map((edge) => edge.sourceWallId)).toEqual([
      "north-wall",
      "east-wall",
      "south-wall",
      "west-wall"
    ]);
    expect(level?.boundaryEdgeUses.map((edgeUse) => [edgeUse.sourceWallId, edgeUse.direction, edgeUse.index])).toEqual([
      ["north-wall", "FORWARD", 0],
      ["east-wall", "FORWARD", 1],
      ["south-wall", "REVERSE", 2],
      ["west-wall", "FORWARD", 3]
    ]);
    expect(loop).toMatchObject({
      id: "loop:living-room:outer",
      kind: "OUTER",
      polygonId: "polygon:living-room",
      boundaryEdgeIds: [
        "boundary-edge:north-wall",
        "boundary-edge:east-wall",
        "boundary-edge:south-wall",
        "boundary-edge:west-wall"
      ],
      vertexIds: [
        "vertex:ground-level:0:0",
        "vertex:ground-level:400:0",
        "vertex:ground-level:400:300",
        "vertex:ground-level:0:300"
      ]
    });
    expect(polygon).toMatchObject({
      id: "polygon:living-room",
      sourceRoomId: "living-room",
      outerLoopId: "loop:living-room:outer",
      innerLoopIds: [],
      metrics: {
        signedArea: 120000,
        area: 120000,
        winding: "COUNTER_CLOCKWISE",
        bounds: {
          minX: 0,
          minZ: 0,
          maxX: 400,
          maxZ: 300
        },
        centroid: {
          x: 200,
          z: 150
        }
      }
    });
    expect(response.geometry).not.toBe(model);
    expect(JSON.stringify(response)).not.toContain("ownerSubject");
    expect(JSON.stringify(response)).not.toContain('"projectId"');
  });

  it("represents shared walls through one boundary edge referenced by two edge uses", () => {
    const project = buildSharedWallProject();
    const response = new GeometrySnapshotApiMapper().toProjectGeometryResponse(project, expectModel(GeometryEngine.build(project)));
    const level = response.geometry.levels[0];
    const sharedEdge = level?.boundaryEdges.find((edge) => edge.sourceWallId === "shared-wall");
    const sharedUses = level?.boundaryEdgeUses.filter((edgeUse) => edgeUse.sourceWallId === "shared-wall") ?? [];

    expect(sharedEdge).toBeDefined();
    expect(sharedUses).toHaveLength(2);
    expect(sharedUses.map((edgeUse) => edgeUse.boundaryEdgeId)).toEqual([
      "boundary-edge:shared-wall",
      "boundary-edge:shared-wall"
    ]);
    expect(sharedUses.map((edgeUse) => edgeUse.direction)).toEqual(["FORWARD", "REVERSE"]);
    expect(level?.polygons.map((polygon) => polygon.sourceRoomId)).toEqual(["room-a", "room-b"]);
  });

  it("sorts set-like incident boundary edge IDs while preserving semantic traversal order", () => {
    const project = buildRectangularRoomProject();
    const response = new GeometrySnapshotApiMapper().toProjectGeometryResponse(project, expectModel(GeometryEngine.build(project)));
    const cornerVertex = response.geometry.levels[0]?.vertices.find((vertex) => vertex.id === "vertex:ground-level:0:0");
    const loop = response.geometry.levels[0]?.loops[0];

    expect(cornerVertex?.incidentBoundaryEdgeIds).toEqual(["boundary-edge:north-wall", "boundary-edge:west-wall"]);
    expect(loop?.boundaryEdgeUseIds).toEqual([
      "boundary-edge-use:living-room:0",
      "boundary-edge-use:living-room:1",
      "boundary-edge-use:living-room:2",
      "boundary-edge-use:living-room:3"
    ]);
  });

  it("rejects mismatched source identity and revision invariants", () => {
    const project = buildRectangularRoomProject();
    const model = expectModel(GeometryEngine.build(project));
    const changedProject = {
      ...project,
      revision: project.revision + 1
    };

    expect(() => new GeometrySnapshotApiMapper().toProjectGeometryResponse(changedProject, model)).toThrow(
      GeometrySnapshotSerializationInvariantError
    );
  });

  it("rejects non-finite numeric runtime output before serialization", () => {
    const project = buildEmptyLevelProject();
    const vertex = new Vertex("vertex:draft-level:bad", Number.POSITIVE_INFINITY, 0, () => []);
    const level = new LevelGeometry("level:draft-level", "draft-level", 0, [vertex], [], [], [], []);
    const model = new GeometryModel("geometry-model:empty-level-project:1", project.id, project.revision, [level]);

    expect(() => new GeometrySnapshotApiMapper().toProjectGeometryResponse(project, model)).toThrow(
      GeometrySnapshotSerializationInvariantError
    );
  });
});

function expectModel(result: ReturnType<typeof GeometryEngine.build>): GeometryModel {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected geometry build to succeed.");
  }

  return result.model;
}

function buildRectangularRoomProject(): Project {
  return ProjectSchema.parse({
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
}

function buildSharedWallProject(): Project {
  return ProjectSchema.parse({
    ...buildRectangularRoomProject(),
    id: "shared-wall-project",
    name: "Shared Wall Project",
    revision: 3,
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
    }
  });
}

function buildEmptyLevelProject(): Project {
  return ProjectSchema.parse({
    ...buildRectangularRoomProject(),
    id: "empty-level-project",
    revision: 1,
    building: {
      id: "main-building",
      name: "Main Building",
      type: "HOUSE",
      levels: [
        {
          id: "draft-level",
          name: "Draft Level",
          elevation: 0,
          rooms: [],
          walls: [],
          staircases: []
        }
      ]
    }
  });
}
