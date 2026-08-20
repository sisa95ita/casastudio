import { describe, expect, it } from "vitest";

import type { GeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import { resolveDrawWallSnapCandidate } from "./project-wall-snapping";

describe("resolveDrawWallSnapCandidate", () => {
  it("prefers an exact canonical Vertex over a nearby Wall interior", () => {
    const candidate = resolveDrawWallSnapCandidate(
      { x: 8, y: 2 },
      createModel({ vertexOrder: ["vertex-b", "vertex-a"] })
    );

    expect(candidate).toEqual({
      kind: "vertex",
      geometryId: "vertex-a",
      point: { x: 0, z: 0 },
      visualDistancePixels: Math.sqrt(8)
    });
  });

  it("projects onto a genuine Wall interior and returns canonical world coordinates", () => {
    const candidate = resolveDrawWallSnapCandidate(
      { x: 55, y: 7 },
      createModel()
    );

    expect(candidate).toMatchObject({
      kind: "wall-interior",
      geometryId: "boundary-edge:wall-b",
      wallId: "wall-b",
      visualDistancePixels: 7
    });
    expect(candidate?.point.x).toBeCloseTo(55);
    expect(candidate?.point.z).toBe(0);
  });

  it("does not treat the endpoint exclusion zone as a Wall interior", () => {
    const model = createModel();
    model.vertices = [];

    expect(resolveDrawWallSnapCandidate({ x: 5, y: 7 }, model)).toBeUndefined();
  });

  it("clears the candidate outside the visual tolerance", () => {
    expect(
      resolveDrawWallSnapCandidate({ x: 50, y: 11 }, createModel())
    ).toBeUndefined();
  });

  it("chooses nearest candidates and uses stable identity for equal distances", () => {
    const model = createModel();
    model.vertices = [
      vertex("vertex-z", 40, 0, 40, 0),
      vertex("vertex-a", 60, 0, 60, 0),
      vertex("vertex-nearest", 51, 0, 51, 0)
    ];
    expect(resolveDrawWallSnapCandidate({ x: 50, y: 0 }, model)?.geometryId).toBe(
      "vertex-nearest"
    );

    model.vertices = [
      vertex("vertex-z", 40, 0, 40, 0),
      vertex("vertex-a", 60, 0, 60, 0)
    ];
    expect(resolveDrawWallSnapCandidate({ x: 50, y: 0 }, model)?.geometryId).toBe(
      "vertex-a"
    );
  });

  it("keeps the same pixel tolerance when world scale changes", () => {
    const normal = createModel();
    const zoomed = createModel();
    zoomed.boundaryEdges = [edge("wall-b", 0, 0, 10, 0, 0, 0, 100, 0)];
    zoomed.vertices = [];
    normal.vertices = [];

    expect(resolveDrawWallSnapCandidate({ x: 50, y: 9 }, normal)?.kind).toBe(
      "wall-interior"
    );
    expect(resolveDrawWallSnapCandidate({ x: 50, y: 9 }, zoomed)?.kind).toBe(
      "wall-interior"
    );
    expect(resolveDrawWallSnapCandidate({ x: 50, y: 11 }, normal)).toBeUndefined();
    expect(resolveDrawWallSnapCandidate({ x: 50, y: 11 }, zoomed)).toBeUndefined();
  });

  it("converts SVG distances into stable CSS-pixel tolerance", () => {
    const model = createModel();
    model.vertices = [];

    expect(
      resolveDrawWallSnapCandidate({ x: 50, y: 18 }, model, 0.5)?.kind
    ).toBe("wall-interior");
    expect(
      resolveDrawWallSnapCandidate({ x: 50, y: 22 }, model, 0.5)
    ).toBeUndefined();
    expect(
      resolveDrawWallSnapCandidate({ x: 50, y: 4.5 }, model, 2)?.kind
    ).toBe("wall-interior");
    expect(
      resolveDrawWallSnapCandidate({ x: 50, y: 5.5 }, model, 2)
    ).toBeUndefined();
  });

  it("uses transformed SVG coordinates after combined zoom and pan", () => {
    const model = createModel();
    model.vertices = [];
    model.boundaryEdges = [
      edge("wall-b", 0, 0, 100, 0, 200, 150, 600, 150)
    ];

    const candidate = resolveDrawWallSnapCandidate(
      { x: 400, y: 158 },
      model,
      1.25
    );

    expect(candidate).toMatchObject({
      kind: "wall-interior",
      point: { x: 50, z: 0 },
      visualDistancePixels: 10
    });
  });
});

function createModel({ vertexOrder = ["vertex-a", "vertex-b"] } = {}) {
  const vertices = {
    "vertex-a": vertex("vertex-a", 10, 0, 0, 0),
    "vertex-b": vertex("vertex-b", 100, 0, 100, 0)
  };
  return {
    levelId: "level-geometry:ground-floor",
    sourceLevelId: "ground-floor",
    bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 },
    polygons: [],
    boundaryEdges: [edge("wall-b", 0, 0, 100, 0, 0, 0, 100, 0)],
    vertices: vertexOrder.map((id) => vertices[id as keyof typeof vertices])
  } as unknown as MutablePresentationModel;
}

type MutablePresentationModel = {
  -readonly [Key in keyof GeometryPresentationModel2D]: GeometryPresentationModel2D[Key] extends readonly (infer Item)[]
    ? Item[]
    : GeometryPresentationModel2D[Key];
};

function vertex(
  geometryId: string,
  screenX: number,
  screenY: number,
  worldX: number,
  worldZ: number
) {
  return {
    kind: "VERTEX" as const,
    geometryId,
    coordinates: { x: worldX, z: worldZ },
    point: { x: screenX, y: screenY },
    selected: false,
    hovered: false
  };
}

function edge(
  wallId: string,
  worldStartX: number,
  worldStartZ: number,
  worldEndX: number,
  worldEndZ: number,
  screenStartX: number,
  screenStartY: number,
  screenEndX: number,
  screenEndY: number
) {
  return {
    kind: "BOUNDARY_EDGE" as const,
    geometryId: `boundary-edge:${wallId}`,
    sourceWallId: wallId,
    startVertexId: "start",
    endVertexId: "end",
    start: {
      world: { x: worldStartX, z: worldStartZ },
      screen: { x: screenStartX, y: screenStartY }
    },
    end: {
      world: { x: worldEndX, z: worldEndZ },
      screen: { x: screenEndX, y: screenEndY }
    },
    midpoint: {
      x: (screenStartX + screenEndX) / 2,
      y: (screenStartY + screenEndY) / 2
    },
    sharedUsageCount: 0,
    selected: false,
    hovered: false
  };
}
