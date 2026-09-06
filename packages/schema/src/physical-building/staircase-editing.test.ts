import { describe, expect, it } from "vitest";
import type { Project, Staircase } from "../index.js";
import { createStaircase, deleteStaircase, updateStaircase } from "./staircase-editing.js";

const project: Project = {
  id: "stair-editing-project",
  name: "Stair editing",
  schemaVersion: "4.0.0",
  revision: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  units: { length: "cm", angle: "deg" },
  building: {
    furniture: [],
    id: "building",
    name: "Building",
    type: "HOUSE",
    levels: [
      { id: "ground", name: "Ground", elevation: 0, rooms: [], walls: [], staircases: [] },
      { id: "upper", name: "Upper", elevation: 300, rooms: [], walls: [], staircases: [] }
    ]
  },
  viewpoints: [], baseImages: [], designBriefs: [], renderRequests: [], renderResults: []
};

const staircase: Staircase = {
  id: "main-stair",
  name: "Main stair",
  fromLevelId: "ground",
  toLevelId: "upper",
  width: 90,
  flights: [{
    id: "main-flight",
    start: { x: 0, z: 0 },
    end: { x: 480, z: 0 },
    width: 90,
    stepCount: 16,
    startElevation: 0,
    endElevation: 300
  }],
  landings: []
};

describe("canonical Staircase editing", () => {
  it("creates, replaces, and deletes the whole aggregate atomically", () => {
    const created = createStaircase(project, { owningLevelId: "ground", staircase });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.project.building.levels[0]?.staircases[0]).toEqual(staircase);

    const updated = updateStaircase(created.project, {
      owningLevelId: "ground",
      staircaseId: staircase.id,
      staircase: { ...staircase, width: 100, flights: [{ ...staircase.flights[0]!, width: 100 }] }
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.project.building.levels[0]?.staircases[0]?.width).toBe(100);

    const deleted = deleteStaircase(updated.project, { owningLevelId: "ground", staircaseId: staircase.id });
    expect(deleted.ok).toBe(true);
    if (deleted.ok) expect(deleted.project.building.levels[0]?.staircases).toEqual([]);
  });

  it("rejects a connection whose final elevation disagrees with its destination", () => {
    const result = createStaircase(project, {
      owningLevelId: "ground",
      staircase: {
        ...staircase,
        flights: [{ ...staircase.flights[0]!, endElevation: 250 }]
      }
    });
    expect(result.ok).toBe(false);
  });
});
