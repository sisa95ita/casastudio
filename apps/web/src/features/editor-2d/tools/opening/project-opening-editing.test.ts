import { describe, expect, it } from "vitest";
import { createDoorPlanGeometry } from "@casastudio/geometry";
import {
  classifyLevelRoomTopology,
  reconcileRoomSubdivision,
  splitWall,
  type Project,
  type Room,
  type Wall
} from "@casastudio/schema";

import {
  commitOpeningPlacementCandidate,
  createOpeningIdentifier,
  findProjectOpening,
  resolveOpeningPlacementCandidate
} from "./project-opening-editing";

describe("Project Opening interaction helpers", () => {
  it("projects Door placement onto angled Walls and validates it", () => {
    const candidate = resolveOpeningPlacementCandidate(project(), "level", { x: 180, z: 180 }, "DOOR", 30);
    expect(candidate).toMatchObject({ wallId: "angled", valid: true, opening: { type: "DOOR", width: 90 } });
    expect(candidate?.projectedPoint.x).toBeCloseTo(candidate?.projectedPoint.z ?? 0);
  });

  it("uses configured transient dimensions for short-Wall placement", () => {
    const source = project();
    source.building.levels[0]!.walls = [wall("short", 0, 0, 80, 0)];
    expect(resolveOpeningPlacementCandidate(source, "level", { x: 40, z: 0 }, "DOOR", 20))
      .toBeUndefined();
    const candidate = resolveOpeningPlacementCandidate(
      source,
      "level",
      { x: 40, z: 0 },
      "DOOR",
      20,
      { width: 70, height: 200, elevation: 0, hingeSide: "END", swingSide: "RIGHT" }
    );
    expect(candidate).toMatchObject({
      valid: true,
      opening: { type: "DOOR", width: 70, height: 200, hingeSide: "END", swingSide: "RIGHT" }
    });
  });

  it("previews and commits a generic Wall Opening exactly", () => {
    const source = project();
    const candidate = resolveOpeningPlacementCandidate(
      source,
      "level",
      { x: 150, z: 150 },
      "OPENING",
      30,
      { width: 140, height: 220, elevation: 10 }
    );
    expect(candidate).toMatchObject({ opening: { type: "OPENING", width: 140, height: 220, elevation: 10 } });
    if (!candidate) return;
    const committed = commitOpeningPlacementCandidate(source, "level", candidate, "wide-passage");
    expect(committed?.ok).toBe(true);
    if (committed?.ok) {
      expect(findProjectOpening(committed.project, "level", "wide-passage")?.opening)
        .toMatchObject({ type: "OPENING", width: 140, height: 220, elevation: 10 });
    }
  });

  it("rejects free-space targets and colliding Window previews", () => {
    expect(resolveOpeningPlacementCandidate(project(), "level", { x: 400, z: 0 }, "WINDOW", 20)).toBeUndefined();
    const source = project();
    source.building.levels[0]!.walls[0]!.openings.push({
      id: "existing",
      type: "WINDOW",
      offsetFromStart: 100,
      width: 120,
      height: 100,
      elevation: 80
    });
    expect(resolveOpeningPlacementCandidate(source, "level", { x: 113, z: 113 }, "WINDOW", 30)?.valid).toBe(false);
  });

  it("creates schema-safe IDs and resolves canonical ownership", () => {
    expect(createOpeningIdentifier(() => "ABC-123")).toBe("opening-abc-123");
    const source = project();
    source.building.levels[0]!.walls[0]!.openings.push({ id: "window", type: "WINDOW", offsetFromStart: 20, width: 60, height: 100, elevation: 80 });
    expect(findProjectOpening(source, "level", "window")?.wall.id).toBe("angled");
  });

  it("commits the exact last preview through junction click ambiguity", () => {
    const source = junctionProject();
    const preview = resolveOpeningPlacementCandidate(
      source,
      "level",
      { x: 294, z: 2 },
      "DOOR",
      30
    );
    expect(preview?.wallId).toBe("horizontal");
    if (!preview || preview.opening.type !== "DOOR") return;
    const previewWall = source.building.levels[0]!.walls.find((wall) => wall.id === preview.wallId)!;
    const previewGeometry = createDoorPlanGeometry(previewWall, preview.opening);

    const committed = commitOpeningPlacementCandidate(source, "level", preview, "junction-door");
    expect(committed?.ok).toBe(true);
    if (!committed?.ok) return;
    const created = findProjectOpening(committed.project, "level", "junction-door");
    expect(created)
      .toMatchObject({ wall: { id: "horizontal" }, opening: { offsetFromStart: preview.opening.offsetFromStart } });
    if (!created || created.opening.type !== "DOOR") return;
    const createdGeometry = createDoorPlanGeometry(created.wall, created.opening);
    expect(createdGeometry.span.start).toEqual(previewGeometry.span.start);
    expect(createdGeometry.span.end).toEqual(previewGeometry.span.end);
    expect(createdGeometry.hinge).toEqual(previewGeometry.hinge);
    expect(createdGeometry.openLeafEnd).toEqual(previewGeometry.openLeafEnd);
    expect(committed.project.building.levels[0]?.walls.find((wall) => wall.id === "vertical")?.openings)
      .toEqual([]);
  });

  it("switches immediately between the nearest finite segments in reconciled authored topology", () => {
    const source = reconciledAuthoredTopologyProject();
    const overVertical = resolveOpeningPlacementCandidate(
      source, "level", { x: 400, z: 660 }, "DOOR", 60
    );
    const overHorizontal = resolveOpeningPlacementCandidate(
      source, "level", { x: 404, z: 700 }, "DOOR", 60
    );
    const backOverVertical = resolveOpeningPlacementCandidate(
      source, "level", { x: 400, z: 696 }, "DOOR", 60
    );

    expect(overVertical?.wallId).toBe("path-two");
    expect(overHorizontal?.wallId).toBe("path-three");
    expect(backOverVertical?.wallId).toBe("path-two");
    if (!overHorizontal) return;
    const committed = commitOpeningPlacementCandidate(
      source, "level", overHorizontal, "authored-door"
    );
    expect(committed?.ok).toBe(true);
    if (!committed?.ok) return;
    expect(findProjectOpening(committed.project, "level", "authored-door")?.wall.id)
      .toBe("path-three");
  });

  it("ranks by closest finite-segment point instead of infinite-line distance", () => {
    const source = project();
    source.building.levels[0]!.walls = [
      wall("a-short-vertical", 50, 0, 50, 100),
      wall("z-current-horizontal", 0, 140, 300, 140)
    ];
    expect(resolveOpeningPlacementCandidate(
      source, "level", { x: 50, z: 140 }, "DOOR", 50
    )?.wallId).toBe("z-current-horizontal");
  });

  it("uses a stable ID tie-break and rejects stale preview Wall state", () => {
    const source = junctionProject();
    source.building.levels[0]!.walls = [...source.building.levels[0]!.walls].reverse();
    const tied = resolveOpeningPlacementCandidate(source, "level", { x: 297, z: 3 }, "WINDOW", 30);
    expect(tied?.wallId).toBe("horizontal");
    if (!tied) return;
    source.building.levels[0]!.walls.find((wall) => wall.id === "horizontal")!.end.x = 320;
    expect(commitOpeningPlacementCandidate(source, "level", tied, "stale-window")).toBeUndefined();
  });

  it("commits onto the exact segment produced by a topology split", () => {
    const split = splitWall(project(), {
      levelId: "level",
      wallId: "angled",
      splitPoint: { x: 150, z: 150 },
      newWallId: "authored-segment"
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    const preview = resolveOpeningPlacementCandidate(
      split.project,
      "level",
      { x: 235, z: 235 },
      "WINDOW",
      25
    );
    expect(preview?.wallId).toBe("authored-segment");
    const committed = preview
      ? commitOpeningPlacementCandidate(split.project, "level", preview, "authored-window")
      : undefined;
    expect(committed?.ok).toBe(true);
    if (!committed?.ok) return;
    expect(findProjectOpening(committed.project, "level", "authored-window")?.wall.id)
      .toBe("authored-segment");
  });
});

function junctionProject(): Project {
  const source = project();
  source.building.levels[0]!.walls = [
    {
      id: "horizontal", start: { x: 0, z: 0 }, end: { x: 300, z: 0 },
      height: 280, thickness: 20, roomIds: [], openings: []
    },
    {
      id: "vertical", start: { x: 300, z: 0 }, end: { x: 300, z: 300 },
      height: 280, thickness: 20, roomIds: [], openings: []
    }
  ];
  return source;
}

function reconciledAuthoredTopologyProject(): Project {
  const source = project();
  const room: Room = {
    id: "whole-room",
    name: "Whole Room",
    type: "OTHER",
    boundary: [
      "bottom", "right-lower", "right-upper", "top", "left-upper", "left-lower"
    ].map((wallId) => ({ wallId, direction: "FORWARD" as const }))
  };
  source.building.levels[0] = {
    ...source.building.levels[0]!,
    rooms: [room],
    walls: [
      wall("bottom", 0, 0, 1000, 0, room.id),
      wall("right-lower", 1000, 0, 1000, 700, room.id),
      wall("right-upper", 1000, 700, 1000, 1000, room.id),
      wall("top", 1000, 1000, 0, 1000, room.id),
      wall("left-upper", 0, 1000, 0, 500, room.id),
      wall("left-lower", 0, 500, 0, 0, room.id),
      wall("path-one", 0, 500, 400, 500),
      wall("path-two", 400, 500, 400, 700),
      wall("path-three", 400, 700, 1000, 700)
    ]
  };
  const subdivision = classifyLevelRoomTopology(source, "level").subdivisions[0]!;
  const additionalFace = subdivision.faces.find(
    (face) => face.key !== subdivision.preservedFaceKey
  )!;
  const reconciled = reconcileRoomSubdivision(source, {
    levelId: "level",
    roomId: room.id,
    expectedFaceKeys: subdivision.faces.map((face) => face.key),
    newRoomAssignments: [{
      faceKey: additionalFace.key,
      room: { id: "authored-room", name: "Authored Room", type: "OTHER" }
    }]
  });
  if (!reconciled.ok) throw new Error("Expected authored topology reconciliation to succeed.");
  return reconciled.project;
}

function wall(
  id: string,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  roomId?: string
): Wall {
  return {
    id,
    start: { x: startX, z: startZ },
    end: { x: endX, z: endZ },
    height: 280,
    thickness: 20,
    roomIds: roomId ? [roomId] : [],
    openings: []
  };
}

function project(): Project {
  return {
    id: "opening-interaction", name: "Opening interaction", schemaVersion: "4.0.0", revision: 1,
    createdAt: "2026-08-23T00:00:00.000Z", updatedAt: "2026-08-23T00:00:00.000Z",
    units: { length: "cm", angle: "deg" },
    building: { furniture: [], id: "building", name: "Building", type: "HOUSE", levels: [{
      id: "level", name: "Level", elevation: 0, rooms: [], staircases: [],
      walls: [{ id: "angled", start: { x: 0, z: 0 }, end: { x: 300, z: 300 }, height: 280, thickness: 20, roomIds: [], openings: [] }]
    }] },
    viewpoints: [], baseImages: [], designBriefs: [], renderRequests: [], renderResults: []
  };
}
