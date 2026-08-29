import { describe, expect, it } from "vitest";
import type { Level, Wall } from "@casastudio/schema";

import {
  createExteriorLevelDimensions,
  createLinearDimension,
  createOrthogonalRoomDimensions,
  createWallDimension,
  documentDistanceToProjectUnits
} from "./architectural-dimensions.js";

describe("linear dimension geometry", () => {
  it("derives exact physical values before presentation projection", () => {
    const dimension = createLinearDimension({
      start: { x: 10, z: 20 },
      end: { x: 310, z: 420 },
      offset: 50,
      markerSize: 10,
      units: { length: "cm" }
    });
    expect(dimension?.physicalValue).toBe(500);
    expect(dimension?.formattedValue).toBe("5.00 m");
    expect(dimension?.direction.orientation).toBe("angled");
    expect(dimension?.labelAnchor).toBeDefined();
    expect(dimension?.extensionLines).toHaveLength(2);
    expect(dimension?.markers).toHaveLength(2);
  });

  it.each([20, 50, 75, 100] as const)("keeps a Wall value fixed at scale 1:%s", (denominator) => {
    const wall = createWall("wall", 0, 0, 500, 0);
    const dimension = createWallDimension(wall, { length: "cm" }, denominator);
    expect(dimension?.physicalValue).toBe(500);
    expect(dimension?.formattedValue).toBe("5.00 m");
  });

  it("changes layout offset, not measurement, when document scale changes", () => {
    const wall = createWall("wall", 0, 0, 500, 0);
    const at50 = createWallDimension(wall, { length: "cm" }, 50)!;
    const at100 = createWallDimension(wall, { length: "cm" }, 100)!;
    expect(at100.physicalValue).toBe(at50.physicalValue);
    expect(Math.abs(at100.dimensionLine.start.z)).toBe(2 * Math.abs(at50.dimensionLine.start.z));
    expect(documentDistanceToProjectUnits(1, 75, "cm")).toBe(75);
  });

  it("returns no dimension for a zero-length input", () => {
    expect(createLinearDimension({
      start: { x: 0, z: 0 },
      end: { x: 0, z: 0 },
      offset: 10,
      units: { length: "cm" }
    })).toBeUndefined();
  });

  it("creates contextual width and depth only for a clear orthogonal Room", () => {
    const rectangle = createLevel([
      createWall("a", 0, 0, 400, 0),
      createWall("b", 400, 0, 400, 300),
      createWall("c", 400, 300, 0, 300),
      createWall("d", 0, 300, 0, 0)
    ]);
    const room = {
      boundary: rectangle.walls.map((wall) => ({ wallId: wall.id, direction: "FORWARD" as const }))
    };
    expect(createOrthogonalRoomDimensions(rectangle, room, { length: "cm" }, 50)
      .map((dimension) => dimension.physicalValue)).toEqual([400, 300]);

    const irregular = createLevel([
      createWall("i-a", 0, 0, 400, 0),
      createWall("i-b", 400, 0, 300, 250),
      createWall("i-c", 300, 250, 0, 300),
      createWall("i-d", 0, 300, 0, 0)
    ]);
    expect(createOrthogonalRoomDimensions(irregular, {
      boundary: irregular.walls.map((wall) => ({ wallId: wall.id, direction: "FORWARD" as const }))
    }, { length: "cm" }, 50)).toEqual([]);
  });
});

describe("exterior Level dimensions", () => {
  it("creates overall dimensions for rectangular and angled geometry", () => {
    const rectangle = createLevel([
      createWall("bottom", 0, 0, 400, 0),
      createWall("right", 400, 0, 400, 300),
      createWall("top", 400, 300, 0, 300),
      createWall("left", 0, 300, 0, 0)
    ]);
    const angled = createLevel([createWall("angled", -100, -50, 200, 350)]);
    expect(createExteriorLevelDimensions(rectangle, { length: "cm" }, 50).overallHorizontal?.physicalValue).toBe(400);
    expect(createExteriorLevelDimensions(rectangle, { length: "cm" }, 50).overallVertical?.physicalValue).toBe(300);
    expect(createExteriorLevelDimensions(angled, { length: "cm" }, 50).overallHorizontal?.physicalValue).toBe(300);
    expect(createExteriorLevelDimensions(angled, { length: "cm" }, 50).overallVertical?.physicalValue).toBe(400);
  });

  it("uses actual exterior endpoint coordinates for restrained L-plan chains", () => {
    const lShape = createLevel([
      createWall("a", 0, 0, 400, 0),
      createWall("b", 400, 0, 400, 200),
      createWall("c", 400, 200, 200, 200),
      createWall("d", 200, 200, 200, 400),
      createWall("e", 200, 400, 0, 400),
      createWall("f", 0, 400, 0, 0)
    ]);
    const dimensions = createExteriorLevelDimensions(lShape, { length: "cm" }, 75);
    expect(dimensions.overallHorizontal?.physicalValue).toBe(400);
    expect(dimensions.overallVertical?.physicalValue).toBe(400);
    expect(dimensions.horizontalChain.map((item) => item.physicalValue)).toEqual([200, 200]);
    expect(dimensions.verticalChain.map((item) => item.physicalValue)).toEqual([200, 200]);
  });

  it("produces no fake dimensions for an empty Level", () => {
    expect(createExteriorLevelDimensions(createLevel([]), { length: "cm" }, 50)).toEqual({
      horizontalChain: [],
      verticalChain: []
    });
  });
});

function createLevel(walls: Wall[]): Level {
  return { id: "level", name: "Level", elevation: 0, walls, rooms: [], staircases: [] };
}

function createWall(id: string, startX: number, startZ: number, endX: number, endZ: number): Wall {
  return { id, start: { x: startX, z: startZ }, end: { x: endX, z: endZ }, height: 280, thickness: 20, roomIds: [], openings: [] };
}
