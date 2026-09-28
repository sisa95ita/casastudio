import {
  createInitialProject,
  createRoomFromShape,
  deriveRoomShapeVertices,
  splitWall,
  type RoomShapeDefinition
} from "@casastudio/schema";
import { GeometryEngine } from "@casastudio/geometry";
import { describe, expect, it } from "vitest";

import type { GeometryPresentationModel2D } from "../../../geometry-2d/presentation/geometry-presentation-model-2d";
import { createRuntimeGeometryPresentationModel2D } from "../../../geometry-2d/presentation/geometry-presentation-model-2d";
import { ViewportTransform2D } from "../../../geometry-2d/viewport/viewport-transform-2d";
import { demoProjectFixture } from "../../../../test/demo-project-fixture";
import { resolveRoomShapeVertexSnap } from "./room-shape-snapping";

const transform = {
  worldToScreen: (point: { readonly x: number; readonly z: number }) => ({
    x: point.x,
    y: -point.z
  })
};

const rectangle: RoomShapeDefinition = {
  kind: "RECTANGLE",
  dimensions: { width: 500, depth: 300 },
  rotation: 0
};

const identifierPool = (prefix: string, count = 16) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

describe("Room Shape vertex snapping", () => {
  it("translates the full rectangle rigidly from a non-origin preview vertex", () => {
    const result = resolveRoomShapeVertexSnap(
      { x: 5, z: 305 },
      rectangle,
      modelWithVertex({ x: 0, z: 0 }),
      transform,
      { currentLevel: emptyCurrentLevel() }
    );

    expect(result).toMatchObject({
      origin: { x: 0, z: 300 },
      primaryMatch: {
        sourceVertexIndex: 1,
        snapCandidate: { kind: "vertex", point: { x: 0, z: 0 } }
      }
    });
    expect(deriveRoomShapeVertices(result!.origin, rectangle)).toEqual([
      { x: 0, z: 300 },
      { x: 0, z: 0 },
      { x: 500, z: 0 },
      { x: 500, z: 300 }
    ]);
  });

  it("snaps final rotated vertices without changing the shape definition", () => {
    const rotated = { ...rectangle, rotation: 90 as const };
    const before = structuredClone(rotated);
    const result = resolveRoomShapeVertexSnap(
      { x: 99, z: 501 },
      rotated,
      modelWithVertex({ x: 100, z: 500 }),
      transform,
      { currentLevel: emptyCurrentLevel() }
    );

    expect(result?.origin).toEqual({ x: 100, z: 500 });
    expect(rotated).toEqual(before);
    expect(deriveRoomShapeVertices(result!.origin, rotated)).toHaveLength(4);
  });

  it("uses concave vertices and keeps current-Level targets above reference targets", () => {
    const lShape: RoomShapeDefinition = {
      kind: "L_SHAPE",
      dimensions: {
        width: 500,
        depth: 400,
        notchWidth: 200,
        notchDepth: 150
      }
    };
    const result = resolveRoomShapeVertexSnap(
      { x: 1, z: 1 },
      lShape,
      modelWithVertex({ x: 301, z: -149 }),
      transform,
      {
        currentLevel: emptyCurrentLevel(),
        referenceTargets: [
          {
            geometryId: "reference:lower:wall:start",
            wallId: "lower-wall",
            point: { x: 300.5, z: -150 },
            screenPoint: { x: 300.5, y: 150 }
          }
        ]
      }
    );

    expect(result).toMatchObject({
      primaryMatch: {
        sourceVertexIndex: 4,
        snapCandidate: { kind: "vertex" }
      }
    });
  });

  it("uses reference targets positionally when no current target qualifies", () => {
    const result = resolveRoomShapeVertexSnap(
      { x: 3, z: 4 },
      rectangle,
      emptyModel(),
      transform,
      {
        currentLevel: emptyCurrentLevel(),
        referenceTargets: [
          {
            geometryId: "reference:ground:wall:start",
            wallId: "ground-wall",
            point: { x: 0, z: 0 },
            screenPoint: { x: 0, y: 0 }
          }
        ]
      }
    );

    expect(result).toMatchObject({
      origin: { x: 0, z: 0 },
      primaryMatch: {
        snapCandidate: { kind: "reference-vertex", wallId: "ground-wall" }
      }
    });
  });

  it("prefers and exposes a complete current-Level Wall edge alignment", () => {
    const currentLevel = currentLevelWithWall(
      "shared-boundary",
      { x: 0, z: 0 },
      { x: 500, z: 0 }
    );
    const model = modelWithWall(
      "shared-boundary",
      { x: 0, z: 0 },
      { x: 500, z: 0 }
    );
    model.vertices.push({
      kind: "VERTEX",
      geometryId: "closer-single-vertex",
      coordinates: { x: 4, z: 303 },
      point: transform.worldToScreen({ x: 4, z: 303 }),
      wallBacked: true,
      selected: false,
      hovered: false
    });

    const result = resolveRoomShapeVertexSnap(
      { x: 3, z: 303 },
      rectangle,
      model,
      transform,
      { currentLevel }
    );

    expect(result?.origin).toEqual({ x: 0, z: 300 });
    expect(result?.matches.map((match) => match.sourceVertexIndex)).toEqual([
      1, 2
    ]);
    expect(result?.edgeAlignments).toContainEqual({
      sourceVertexIndices: [1, 2],
      wallIds: ["shared-boundary"],
      kind: "current-wall"
    });
    expect(deriveRoomShapeVertices(result!.origin, rectangle)).toEqual([
      { x: 0, z: 300 },
      { x: 0, z: 0 },
      { x: 500, z: 0 },
      { x: 500, z: 300 }
    ]);
  });

  it("derives a canonical Wall chain from the real Project geometry pipeline", () => {
    const initial = createInitialProject({
      projectId: "snap-pipeline-project",
      buildingId: "building",
      levelId: "ground",
      name: "Snap pipeline",
      createdAt: "2026-09-26T08:00:00+02:00"
    });
    const base = createRoomFromShape(initial, {
      levelId: "ground",
      origin: { x: 0, z: 300 },
      shape: rectangle,
      room: { id: "base-room", name: "Base", type: "OTHER" },
      wallIds: ["base-left", "base-bottom", "base-right", "base-top"],
      splitWallIds: ["base-split-1", "base-split-2"],
      wallHeight: 300,
      wallThickness: 20
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const split = splitWall(base.project, {
      levelId: "ground",
      wallId: "base-top",
      splitPoint: { x: 100, z: 300 },
      newWallId: "base-top-left"
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    const geometry = GeometryEngine.build(split.project);
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    const pipelineTransform = new ViewportTransform2D({
      scale: 1,
      offsetX: 0,
      offsetY: 0
    });
    const model = createRuntimeGeometryPresentationModel2D({
      level: geometry.model.levels[0]!,
      transform: pipelineTransform
    });
    const currentLevel = split.project.building.levels[0]!;

    const result = resolveRoomShapeVertexSnap(
      { x: 3, z: 603 },
      rectangle,
      model,
      pipelineTransform,
      { currentLevel }
    );

    expect(result?.origin).toEqual({ x: 0, z: 600 });
    expect(result?.matches.map((match) => match.sourceVertexIndex)).toEqual([
      1, 2
    ]);
    expect(result?.primaryMatch.wallIds).toEqual([
      "base-left",
      "base-top-left"
    ]);
    expect(result?.edgeAlignments).toContainEqual({
      sourceVertexIndices: [1, 2],
      wallIds: ["base-top-left", "base-top"],
      kind: "current-wall"
    });

    const committed = createRoomFromShape(split.project, {
      levelId: "ground",
      origin: result!.origin,
      shape: rectangle,
      room: { id: "adjacent-room", name: "Adjacent", type: "OTHER" },
      wallIds: identifierPool("adjacent-wall"),
      splitWallIds: identifierPool("adjacent-split"),
      wallHeight: 300,
      wallThickness: 20
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.project.building.levels[0]!.walls).toHaveLength(8);
    expect(
      committed.project.building.levels[0]!.rooms[1]!.boundary
    ).toHaveLength(5);
  });

  it("keeps a sub-tolerance snapped preview canonically committable", () => {
    const shape: RoomShapeDefinition = {
      kind: "RECTANGLE",
      dimensions: { width: 1, depth: 0.2 }
    };
    const initial = createInitialProject({
      projectId: "fractional-snap-project",
      buildingId: "building",
      levelId: "ground",
      name: "Fractional snap",
      createdAt: "2026-09-26T08:00:00+02:00"
    });
    const base = createRoomFromShape(initial, {
      levelId: "ground",
      origin: { x: 0, z: 0.1 },
      shape,
      room: { id: "base-room", name: "Base", type: "OTHER" },
      wallIds: identifierPool("base-wall"),
      splitWallIds: identifierPool("base-split"),
      wallHeight: 3,
      wallThickness: 0.1
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const geometry = GeometryEngine.build(base.project);
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    const scaledTransform = new ViewportTransform2D({
      scale: 100,
      offsetX: 0,
      offsetY: 0
    });
    const model = createRuntimeGeometryPresentationModel2D({
      level: geometry.model.levels[0]!,
      transform: scaledTransform
    });
    const currentLevel = base.project.building.levels[0]!;

    const snapped = resolveRoomShapeVertexSnap(
      { x: 0.01, z: 0.31 },
      shape,
      model,
      scaledTransform,
      { currentLevel }
    );

    expect(snapped).toBeDefined();
    const previewVertices = deriveRoomShapeVertices(snapped!.origin, shape)!;
    expect(previewVertices[1]!.z).not.toBe(currentLevel.walls[3]!.start.z);
    const committed = createRoomFromShape(base.project, {
      levelId: "ground",
      origin: snapped!.origin,
      shape,
      room: { id: "adjacent-room", name: "Adjacent", type: "OTHER" },
      wallIds: identifierPool("adjacent-wall"),
      splitWallIds: identifierPool("adjacent-split"),
      wallHeight: 3,
      wallThickness: 0.1
    });
    expect(committed.ok).toBe(true);
  });

  it("does not change a 500 cm Room edge to match a 503 cm Wall", () => {
    const result = resolveRoomShapeVertexSnap(
      { x: 3, z: 303 },
      rectangle,
      modelWithWall("shared-boundary", { x: 0, z: 0 }, { x: 503, z: 0 }),
      transform,
      {
        currentLevel: currentLevelWithWall(
          "shared-boundary",
          { x: 0, z: 0 },
          { x: 503, z: 0 }
        )
      }
    );

    expect(result?.matches).toHaveLength(1);
    expect(result?.edgeAlignments).toEqual([]);
    const vertices = deriveRoomShapeVertices(result!.origin, rectangle)!;
    expect(
      Math.hypot(
        vertices[2]!.x - vertices[1]!.x,
        vertices[2]!.z - vertices[1]!.z
      )
    ).toBe(500);
  });

  it("keeps a 350/500 partial edge alignment as a single endpoint match", () => {
    const shortRectangle: RoomShapeDefinition = {
      kind: "RECTANGLE",
      dimensions: { width: 350, depth: 300 },
      rotation: 0
    };
    const result = resolveRoomShapeVertexSnap(
      { x: 3, z: 303 },
      shortRectangle,
      modelWithWall("shared-boundary", { x: 0, z: 0 }, { x: 500, z: 0 }),
      transform,
      {
        currentLevel: currentLevelWithWall(
          "shared-boundary",
          { x: 0, z: 0 },
          { x: 500, z: 0 }
        )
      }
    );

    expect(result?.origin).toEqual({ x: 0, z: 300 });
    expect(result?.matches).toHaveLength(1);
    expect(result?.edgeAlignments).toEqual([]);
    expect(
      deriveRoomShapeVertices(result!.origin, shortRectangle)?.[2]
    ).toEqual({
      x: 350,
      z: 0
    });
  });

  it("reports both endpoints of one reference Wall as positional matches", () => {
    const result = resolveRoomShapeVertexSnap(
      { x: 3, z: 303 },
      rectangle,
      emptyModel(),
      transform,
      {
        currentLevel: emptyCurrentLevel(),
        referenceTargets: [
          {
            geometryId: "reference:ground:wall:start",
            wallId: "ground-wall",
            point: { x: 0, z: 0 },
            screenPoint: { x: 0, y: 0 }
          },
          {
            geometryId: "reference:ground:wall:end",
            wallId: "ground-wall",
            point: { x: 500, z: 0 },
            screenPoint: { x: 500, y: 0 }
          }
        ]
      }
    );

    expect(result?.origin).toEqual({ x: 0, z: 300 });
    expect(result?.matches).toHaveLength(2);
    expect(
      result?.matches.every(
        (match) => match.snapCandidate.kind === "reference-vertex"
      )
    ).toBe(true);
    expect(result?.edgeAlignments).toContainEqual({
      sourceVertexIndices: [1, 2],
      wallIds: ["ground-wall"],
      kind: "reference-wall"
    });
  });

  it("commits reference-aligned coordinates without cross-Level topology", () => {
    const project = structuredClone(demoProjectFixture);
    const lowerBefore = structuredClone(project.building.levels[0]!);
    project.building.levels.push({
      id: "upper",
      name: "Upper",
      elevation: 300,
      rooms: [],
      walls: [],
      staircases: []
    });
    const target = lowerBefore.walls[0]!.start;
    const targetEnd = lowerBefore.walls[0]!.end;
    const shape: RoomShapeDefinition = {
      kind: "RECTANGLE",
      dimensions: { width: 400, depth: 100 }
    };
    const snap = resolveRoomShapeVertexSnap(
      { x: target.x + 2, z: target.z + 103 },
      shape,
      emptyModel(),
      transform,
      {
        currentLevel: project.building.levels[1]!,
        referenceTargets: [
          {
            geometryId: "reference:ground:first-wall:start",
            wallId: lowerBefore.walls[0]!.id,
            point: target,
            screenPoint: transform.worldToScreen(target)
          },
          {
            geometryId: "reference:ground:first-wall:end",
            wallId: lowerBefore.walls[0]!.id,
            point: targetEnd,
            screenPoint: transform.worldToScreen(targetEnd)
          }
        ]
      }
    );
    expect(snap?.matches).toHaveLength(2);
    expect(snap?.edgeAlignments).toContainEqual({
      sourceVertexIndices: [1, 2],
      wallIds: [lowerBefore.walls[0]!.id],
      kind: "reference-wall"
    });
    const committed = createRoomFromShape(project, {
      levelId: "upper",
      origin: snap!.origin,
      shape,
      room: { id: "upper-room", name: "Upper Room", type: "OTHER" },
      wallIds: ["upper-wall-1", "upper-wall-2", "upper-wall-3", "upper-wall-4"],
      splitWallIds: [
        "upper-split-1",
        "upper-split-2",
        "upper-split-3",
        "upper-split-4"
      ],
      wallHeight: 270,
      wallThickness: 20
    });

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.project.building.levels[0]).toEqual(lowerBefore);
    const upper = committed.project.building.levels[1]!;
    expect(upper.walls.map((wall) => wall.id)).toEqual([
      "upper-wall-1",
      "upper-wall-2",
      "upper-wall-3",
      "upper-wall-4"
    ]);
    expect(upper.walls[1]?.start).toEqual(target);
    expect(upper.walls[1]?.end).toEqual(targetEnd);
    expect(
      upper.walls.some((wall) =>
        lowerBefore.walls.some((lowerWall) => lowerWall === wall)
      )
    ).toBe(false);
  });
});

function emptyModel(): GeometryPresentationModel2D {
  return {
    levelId: "level:active",
    sourceLevelId: "active",
    bounds: { minX: 0, minZ: 0, maxX: 0, maxZ: 0 },
    polygons: [],
    boundaryEdges: [],
    vertices: []
  } as unknown as GeometryPresentationModel2D;
}

function emptyCurrentLevel() {
  return { id: "active", walls: [] };
}

function currentLevelWithWall(
  id: string,
  start: { readonly x: number; readonly z: number },
  end: { readonly x: number; readonly z: number }
) {
  return {
    id: "active",
    walls: [
      {
        id,
        start,
        end,
        height: 300,
        thickness: 20,
        roomIds: [],
        openings: []
      }
    ]
  };
}

function modelWithVertex(point: { readonly x: number; readonly z: number }) {
  return {
    ...emptyModel(),
    vertices: [
      {
        kind: "VERTEX" as const,
        geometryId: "current-vertex",
        coordinates: point,
        point: transform.worldToScreen(point),
        wallBacked: true,
        selected: false,
        hovered: false
      }
    ]
  } as GeometryPresentationModel2D;
}

function modelWithWall(
  wallId: string,
  start: { readonly x: number; readonly z: number },
  end: { readonly x: number; readonly z: number }
) {
  return {
    ...emptyModel(),
    boundaryEdges: [
      {
        kind: "BOUNDARY_EDGE" as const,
        geometryId: `edge:${wallId}`,
        sourceWallId: wallId,
        sourceKind: "WALL" as const,
        startVertexId: `vertex:${wallId}:start`,
        endVertexId: `vertex:${wallId}:end`,
        start: { world: start, screen: transform.worldToScreen(start) },
        end: { world: end, screen: transform.worldToScreen(end) },
        midpoint: {
          x: (start.x + end.x) / 2,
          y: -(start.z + end.z) / 2
        },
        sharedUsageCount: 1,
        selected: false,
        hovered: false
      }
    ],
    vertices: [
      {
        kind: "VERTEX" as const,
        geometryId: `vertex:${wallId}:start`,
        coordinates: start,
        point: transform.worldToScreen(start),
        wallBacked: true,
        selected: false,
        hovered: false
      },
      {
        kind: "VERTEX" as const,
        geometryId: `vertex:${wallId}:end`,
        coordinates: end,
        point: transform.worldToScreen(end),
        wallBacked: true,
        selected: false,
        hovered: false
      }
    ]
  } as GeometryPresentationModel2D & {
    vertices: Array<GeometryPresentationModel2D["vertices"][number]>;
  };
}
