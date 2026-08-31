import { type Project } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../test/demo-project-fixture";
import { createArchitecturalScene3DModel } from "./architectural-scene-3d-model";
import {
  collectArchitecturalSelectionTargets3D,
  isArchitecturalSelectionVisible3D,
  resolveArchitecturalSelection3D,
  type ArchitecturalSelectionKind3D
} from "./architectural-selection-3d";

describe("architectural 3D selection model", () => {
  const model = createArchitecturalScene3DModel(createSelectableProject());

  it.each([
    ["wall", "left-room-north-wall"],
    ["door", "selection-door"],
    ["window", "selection-window"],
    ["wall-opening", "selection-opening"],
    ["room", "left-room"]
  ] as const)("selects %s by canonical ID", (kind, id) => {
    const selection = resolveArchitecturalSelection3D(model, {
      kind,
      id,
      levelId: "ground-floor"
    });

    expect(selection).toMatchObject({
      kind,
      id,
      levelId: "ground-floor",
      levelName: "Ground Floor"
    });
    expect(Object.isFrozen(selection)).toBe(true);
  });

  it("derives Door, Window, and Wall Opening ownership and dimensions from the pure model", () => {
    const door = select("door", "selection-door");
    const window = select("window", "selection-window");
    const opening = select("wall-opening", "selection-opening");

    expect(door).toMatchObject({ wallId: "left-room-north-wall" });
    expect(door.door?.frame).toMatchObject({ width: 0.9, height: 2.1 });
    expect(door.door).toMatchObject({ hingeSide: "END", swingSide: "RIGHT" });
    expect(window).toMatchObject({ wallId: "left-room-east-shared-wall" });
    expect(window.window?.frame).toMatchObject({ width: 1, height: 1.2, elevation: 0.9 });
    expect(opening).toMatchObject({ wallId: "left-room-south-wall" });
    expect(opening.wallOpening?.frame).toMatchObject({ width: 1, height: 2.2 });
  });

  it("derives Room name, type, and exact square-meter area without Project lookup", () => {
    const room = select("room", "left-room");

    expect(room.floor).toMatchObject({
      roomId: "left-room",
      roomName: "Left Room",
      roomType: "LIVING_ROOM",
      area: 12
    });
  });

  it("returns no selection for an unknown canonical ID", () => {
    expect(resolveArchitecturalSelection3D(model, {
      kind: "wall",
      id: "missing",
      levelId: "ground-floor"
    }))
      .toBeUndefined();
    expect(resolveArchitecturalSelection3D(model, {
      kind: "wall",
      id: "left-room-north-wall",
      levelId: "missing-level"
    })).toBeUndefined();
  });

  it("derives semantic browser hit points from canonical identities rather than object UUIDs", () => {
    const targets = collectArchitecturalSelectionTargets3D(model.levels);

    expect(targets.map((target) => `${target.identity.kind}:${target.identity.id}`))
      .toEqual(expect.arrayContaining([
        "wall:left-room-north-wall",
        "door:selection-door",
        "window:selection-window",
        "wall-opening:selection-opening",
        "room:left-room"
      ]));
    expect(targets.every((target) => Object.values(target.point).every(Number.isFinite)))
      .toBe(true);
  });

  it("clears validity when Active Level hides the selected entity", () => {
    const wall = select("wall", "left-room-north-wall");

    expect(isArchitecturalSelectionVisible3D(wall, "all", "upper")).toBe(true);
    expect(isArchitecturalSelectionVisible3D(wall, "active", "ground-floor")).toBe(true);
    expect(isArchitecturalSelectionVisible3D(wall, "active", "upper")).toBe(false);
  });

  function select(kind: ArchitecturalSelectionKind3D, id: string) {
    const selection = resolveArchitecturalSelection3D(model, {
      kind,
      id,
      levelId: "ground-floor"
    });
    expect(selection).toBeDefined();
    return selection!;
  }
});

function createSelectableProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const walls = project.building.levels[0]!.walls;
  walls[0]!.openings = [{
    id: "selection-door",
    type: "DOOR",
    offsetFromStart: 50,
    width: 90,
    height: 210,
    elevation: 0,
    hingeSide: "END",
    swingSide: "RIGHT"
  }];
  walls[1]!.openings = [{
    id: "selection-window",
    type: "WINDOW",
    offsetFromStart: 50,
    width: 100,
    height: 120,
    elevation: 90
  }];
  walls[2]!.openings = [{
    id: "selection-opening",
    type: "OPENING",
    offsetFromStart: 50,
    width: 100,
    height: 220,
    elevation: 0
  }];
  return project;
}
