import type { ProjectGeometryResponse } from "../api/api-types";

export function createGeometrySnapshotFixture(
  sourceProjectId: string,
  sourceRevision: number,
  levelId = "geometry-level-ground"
): ProjectGeometryResponse {
  return {
    sourceProjectId,
    sourceRevision,
    geometry: {
      id: `geometry:${sourceProjectId}:${sourceRevision}`,
      units: { length: "cm", angle: "deg" },
      levels: [
        {
          id: levelId,
          sourceLevelId: "level-ground",
          elevation: 0,
          vertices: [
            { id: "vertex:0:0", x: 0, z: 0, incidentBoundaryEdgeIds: ["edge:south", "edge:west"] },
            { id: "vertex:100:0", x: 100, z: 0, incidentBoundaryEdgeIds: ["edge:south", "edge:east"] },
            { id: "vertex:100:100", x: 100, z: 100, incidentBoundaryEdgeIds: ["edge:east", "edge:north"] },
            { id: "vertex:0:100", x: 0, z: 100, incidentBoundaryEdgeIds: ["edge:north", "edge:west"] }
          ],
          boundaryEdges: [
            createEdge("edge:south", "wall-south", "vertex:0:0", "vertex:100:0", { x: 0, z: 0 }, { x: 100, z: 0 }),
            createEdge("edge:east", "wall-east", "vertex:100:0", "vertex:100:100", { x: 100, z: 0 }, { x: 100, z: 100 }),
            createEdge("edge:north", "wall-north", "vertex:100:100", "vertex:0:100", { x: 100, z: 100 }, { x: 0, z: 100 }),
            createEdge("edge:west", "wall-west", "vertex:0:100", "vertex:0:0", { x: 0, z: 100 }, { x: 0, z: 0 })
          ],
          boundaryEdgeUses: [
            createEdgeUse(0, "edge:south", "wall-south", "vertex:0:0", "vertex:100:0", { x: 0, z: 0 }, { x: 100, z: 0 }),
            createEdgeUse(1, "edge:east", "wall-east", "vertex:100:0", "vertex:100:100", { x: 100, z: 0 }, { x: 100, z: 100 }),
            createEdgeUse(2, "edge:north", "wall-north", "vertex:100:100", "vertex:0:100", { x: 100, z: 100 }, { x: 0, z: 100 }),
            createEdgeUse(3, "edge:west", "wall-west", "vertex:0:100", "vertex:0:0", { x: 0, z: 100 }, { x: 0, z: 0 })
          ],
          loops: [
            {
              id: "loop:room-one:outer",
              kind: "OUTER",
              polygonId: "polygon:room-one",
              boundaryEdgeUseIds: ["edge-use:0", "edge-use:1", "edge-use:2", "edge-use:3"],
              boundaryEdgeIds: ["edge:south", "edge:east", "edge:north", "edge:west"],
              vertexIds: ["vertex:0:0", "vertex:100:0", "vertex:100:100", "vertex:0:100"]
            }
          ],
          polygons: [
            {
              id: "polygon:room-one",
              sourceRoomId: "room-one",
              outerLoopId: "loop:room-one:outer",
              innerLoopIds: [],
              loopIds: ["loop:room-one:outer"],
              boundaryEdgeUseIds: ["edge-use:0", "edge-use:1", "edge-use:2", "edge-use:3"],
              boundaryEdgeIds: ["edge:south", "edge:east", "edge:north", "edge:west"],
              vertexIds: ["vertex:0:0", "vertex:100:0", "vertex:100:100", "vertex:0:100"],
              metrics: {
                signedArea: 10000,
                area: 10000,
                winding: "COUNTER_CLOCKWISE",
                bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 },
                centroid: { x: 50, z: 50 }
              }
            }
          ]
        }
      ]
    }
  };
}

type Point = { readonly x: number; readonly z: number };

function createEdge(
  id: string,
  sourceWallId: string,
  startVertexId: string,
  endVertexId: string,
  start: Point,
  end: Point
) {
  return { id, sourceWallId, startVertexId, endVertexId, start, end, thickness: 10, height: 280 };
}

function createEdgeUse(
  index: number,
  boundaryEdgeId: string,
  sourceWallId: string,
  startVertexId: string,
  endVertexId: string,
  start: Point,
  end: Point
) {
  return {
    id: `edge-use:${index}`,
    boundaryEdgeId,
    sourceWallId,
    direction: "FORWARD" as const,
    index,
    loopId: "loop:room-one:outer",
    startVertexId,
    endVertexId,
    start,
    end
  };
}
