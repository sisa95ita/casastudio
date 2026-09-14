import { describe, expect, it } from "vitest";
import type { FurnitureItem } from "@casastudio/schema";
import { furnitureProjectFixture } from "../../../test/furniture-project-fixture";
import {
  commitFurnitureInteraction,
  validateFurniturePlacement
} from "../../editor-2d/tools/furniture/project-furniture-authoring";

const item = (
  overrides: Partial<FurnitureItem> = {}
): FurnitureItem => ({
  id: "candidate",
  definitionId: "generic-table",
  roomId: "living",
  position: { x: 300, z: 300 },
  rotation: 0,
  width: 100,
  depth: 60,
  height: 75,
  ...overrides
});

describe("Furniture placement footprints", () => {
  it("allows clear and wall-tangent footprints but blocks crossing and rotated Wall overlap", () => {
    const project = furnitureProjectFixture();
    expect(validateFurniturePlacement(project, "ground", item()).status).toBe(
      "VALID"
    );
    expect(
      validateFurniturePlacement(
        project,
        "ground",
        item({ position: { x: 60, z: 300 } })
      ).status
    ).toBe("VALID");
    expect(
      validateFurniturePlacement(
        project,
        "ground",
        item({ position: { x: 55, z: 300 } })
      )
    ).toEqual({ status: "INVALID", issue: "WALL_INTERSECTION" });
    expect(
      validateFurniturePlacement(
        project,
        "ground",
        item({
          position: { x: 60, z: 300 },
          width: 120,
          depth: 40,
          rotation: 45
        })
      )
    ).toEqual({ status: "INVALID", issue: "WALL_INTERSECTION" });
  });

  it("blocks strict same-floor overlap, allows edge contact, and permits vertical overlap", () => {
    const project = furnitureProjectFixture();
    project.building.furniture = [item({ id: "existing" })];
    expect(
      validateFurniturePlacement(
        project,
        "ground",
        item({ position: { x: 340, z: 300 } })
      )
    ).toEqual({ status: "INVALID", issue: "FURNITURE_INTERSECTION" });
    expect(
      validateFurniturePlacement(
        project,
        "ground",
        item({ position: { x: 400, z: 300 } })
      ).status
    ).toBe("VALID");
    expect(
      validateFurniturePlacement(project, "ground", item({ roomId: "study" }))
        .status
    ).toBe("VALID");
  });

  it("reports Stair overlap as a warning and still permits commit", () => {
    const project = furnitureProjectFixture();
    project.building.levels.push({
      id: "upper",
      name: "Upper",
      elevation: 280,
      rooms: [],
      walls: [],
      staircases: []
    });
    project.building.levels[0]!.staircases.push({
      id: "stair",
      name: "Straight stair",
      fromLevelId: "ground",
      toLevelId: "upper",
      width: 100,
      flights: [
        {
          id: "flight",
          start: { x: 250, z: 300 },
          end: { x: 350, z: 300 },
          width: 100,
          stepCount: 10,
          startElevation: 0,
          endElevation: 280
        }
      ],
      landings: []
    });
    const candidate = item({ width: 50, depth: 50 });
    expect(validateFurniturePlacement(project, "ground", candidate)).toEqual({
      status: "WARNING",
      warning: "STAIRCASE_OVERLAP"
    });
    const result = commitFurnitureInteraction(
      project,
      "ground",
      {
        kind: "furniture",
        intent: "place",
        item: candidate,
        positioned: true
      },
      "under-stair"
    );
    expect(result?.ok).toBe(true);
  });

  it("blocks invalid commits before canonical mutation", () => {
    const project = furnitureProjectFixture();
    const result = commitFurnitureInteraction(
      project,
      "ground",
      {
        kind: "furniture",
        intent: "place",
        item: item({ position: { x: 55, z: 300 } }),
        positioned: true
      },
      "blocked"
    );
    expect(result).toBeUndefined();
    expect(project.building.furniture).toEqual([]);
  });
});
