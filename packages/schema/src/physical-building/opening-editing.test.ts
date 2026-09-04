import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import { ValidationErrorCode } from "../validation/index.js";
import {
  createDoor,
  createWallOpening,
  createWindow,
  deleteOpening,
  moveOpening,
  updateOpening
} from "./opening-editing.js";

describe("Opening editing", () => {
  it("creates oriented Doors and Windows immutably", () => {
    const project = createProject();
    const door = createDoor(project, {
      levelId: "ground-floor",
      wallId: "wall",
      door: {
        id: "entry-door",
        type: "DOOR",
        offsetFromStart: 20,
        width: 90,
        height: 210,
        elevation: 0,
        hingeSide: "START",
        swingSide: "LEFT"
      }
    });
    expect(door.ok).toBe(true);
    if (!door.ok) return;
    expect(project.building.levels[0]?.walls[0]?.openings).toEqual([]);

    const window = createWindow(door.project, {
      levelId: "ground-floor",
      wallId: "wall",
      window: {
        id: "front-window",
        type: "WINDOW",
        offsetFromStart: 160,
        width: 120,
        height: 120,
        elevation: 90
      }
    });
    expect(window.ok).toBe(true);
    if (window.ok) expect(window.project.building.levels[0]?.walls[0]?.openings).toHaveLength(2);
  });

  it("allows touching intervals and rejects overlap", () => {
    const project = withWindow(createProject(), "first", 20, 80);
    expect(createWindow(project, {
      levelId: "ground-floor",
      wallId: "wall",
      window: { id: "touching", type: "WINDOW", offsetFromStart: 100, width: 50, height: 100, elevation: 80 }
    }).ok).toBe(true);
    expect(createWindow(project, {
      levelId: "ground-floor",
      wallId: "wall",
      window: { id: "overlap", type: "WINDOW", offsetFromStart: 99.99, width: 50, height: 100, elevation: 80 }
    })).toMatchObject({ ok: false, errors: [{ code: ValidationErrorCode.OPENING_COLLISION }] });
  });

  it("creates and validates a generic Wall Opening with the shared fit contract", () => {
    const valid = createWallOpening(createProject(), {
      levelId: "ground-floor",
      wallId: "wall",
      wallOpening: { id: "passage", type: "OPENING", offsetFromStart: 40, width: 180, height: 220, elevation: 0 }
    });
    expect(valid.ok).toBe(true);
    expect(createWallOpening(createProject(), {
      levelId: "ground-floor",
      wallId: "wall",
      wallOpening: { id: "too-tall", type: "OPENING", offsetFromStart: 40, width: 180, height: 300, elevation: 0 }
    })).toMatchObject({ ok: false, errors: [{ code: ValidationErrorCode.OPENING_OUTSIDE_WALL_HEIGHT }] });
  });

  it("rejects endpoint overflow and invalid vertical Window extent", () => {
    expect(createWindow(createProject(), {
      levelId: "ground-floor",
      wallId: "wall",
      window: { id: "outside", type: "WINDOW", offsetFromStart: 450, width: 60, height: 100, elevation: 80 }
    })).toMatchObject({ ok: false, errors: [{ code: ValidationErrorCode.OPENING_OUTSIDE_WALL }] });
    expect(createWindow(createProject(), {
      levelId: "ground-floor",
      wallId: "wall",
      window: { id: "too-tall", type: "WINDOW", offsetFromStart: 20, width: 60, height: 220, elevation: 80 }
    })).toMatchObject({ ok: false, errors: [{ code: ValidationErrorCode.OPENING_OUTSIDE_WALL_HEIGHT }] });
  });

  it("moves, updates, flips, and deletes an Opening as separate immutable mutations", () => {
    const created = createDoor(createProject(), {
      levelId: "ground-floor",
      wallId: "wall",
      door: { id: "door", type: "DOOR", offsetFromStart: 20, width: 90, height: 210, elevation: 0, hingeSide: "START", swingSide: "LEFT" }
    });
    if (!created.ok) throw new Error("fixture creation failed");
    const moved = moveOpening(created.project, { levelId: "ground-floor", wallId: "wall", openingId: "door", offsetFromStart: 40 });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const flipped = updateOpening(moved.project, { levelId: "ground-floor", wallId: "wall", openingId: "door", width: 100, hingeSide: "END", swingSide: "RIGHT" });
    expect(flipped.ok).toBe(true);
    if (!flipped.ok) return;
    expect(flipped.project.building.levels[0]?.walls[0]?.openings[0]).toMatchObject({ offsetFromStart: 40, width: 100, hingeSide: "END", swingSide: "RIGHT" });
    const deleted = deleteOpening(flipped.project, { levelId: "ground-floor", wallId: "wall", openingId: "door" });
    expect(deleted.ok).toBe(true);
    if (deleted.ok) expect(deleted.project.building.levels[0]?.walls[0]?.openings).toEqual([]);
  });
});

function withWindow(project: Project, id: string, offsetFromStart: number, width: number): Project {
  const copy = structuredClone(project);
  copy.building.levels[0]!.walls[0]!.openings.push({ id, type: "WINDOW", offsetFromStart, width, height: 100, elevation: 80 });
  return copy;
}

function createProject(): Project {
  return {
    id: "opening-editing",
    name: "Opening editing",
    schemaVersion: "3.0.0",
    revision: 1,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    units: { length: "cm", angle: "deg" },
    building: {
      id: "building",
      name: "Building",
      type: "HOUSE",
      levels: [{
        id: "ground-floor",
        name: "Ground Floor",
        elevation: 0,
        rooms: [],
        walls: [{ id: "wall", start: { x: 0, z: 0 }, end: { x: 500, z: 0 }, height: 280, thickness: 20, roomIds: [], openings: [] }],
        staircases: []
      }]
    },
    viewpoints: [], baseImages: [], designBriefs: [], renderRequests: [], renderResults: []
  };
}
