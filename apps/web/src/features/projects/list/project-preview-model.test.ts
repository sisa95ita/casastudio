import { describe, expect, it } from "vitest";

import type { ProjectPreview } from "../../../core/api/api-types";
import {
  createProjectPreviewModel,
  projectPreviewViewport
} from "./project-preview-model";

describe("Project preview model", () => {
  it("derives finite fitted Wall geometry with a uniform aspect-preserving scale", () => {
    const model = createProjectPreviewModel(
      preview([
        wall("wide", 0, 0, 800, 0, 20),
        wall("tall", 800, 0, 800, 400, 20)
      ])
    );

    expect(model.empty).toBe(false);
    expect(model.levelId).toBe("ground");
    expect(model.wallShapes).toHaveLength(2);
    expect(model.scale).toBeGreaterThan(0);
    expect(Object.values(model.bounds ?? {}).every(Number.isFinite)).toBe(true);

    const coordinates = model.wallShapes.flatMap((shape) =>
      shape.svgPoints.split(" ").flatMap((pair) => pair.split(",").map(Number))
    );
    expect(coordinates.every(Number.isFinite)).toBe(true);
    for (let index = 0; index < coordinates.length; index += 2) {
      expect(coordinates[index]).toBeGreaterThanOrEqual(0);
      expect(coordinates[index]).toBeLessThanOrEqual(
        projectPreviewViewport.width
      );
      expect(coordinates[index + 1]).toBeGreaterThanOrEqual(0);
      expect(coordinates[index + 1]).toBeLessThanOrEqual(
        projectPreviewViewport.height
      );
    }
  });

  it.each([undefined, preview([])])(
    "returns an intentional empty state for missing or empty geometry",
    (input) => {
      expect(createProjectPreviewModel(input)).toMatchObject({
        empty: true,
        wallShapes: []
      });
    }
  );

  it("keeps multiple preview instances independent and immutable", () => {
    const first = createProjectPreviewModel(
      preview([wall("first", 0, 0, 100, 0, 10)])
    );
    const second = createProjectPreviewModel(
      preview([wall("second", 0, 0, 0, 300, 30)], "upper")
    );

    expect(first).not.toBe(second);
    expect(first.levelId).toBe("ground");
    expect(second.levelId).toBe("upper");
    expect(first.wallShapes[0]?.id).toBe("first");
    expect(second.wallShapes[0]?.id).toBe("second");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.wallShapes)).toBe(true);
  });
});

function preview(
  walls: ProjectPreview["walls"],
  levelId = "ground"
): ProjectPreview {
  return { levelId, elevation: 0, walls };
}

function wall(
  id: string,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  thickness: number
): ProjectPreview["walls"][number] {
  return {
    id,
    start: { x: startX, z: startZ },
    end: { x: endX, z: endZ },
    thickness
  };
}
