import {
  createInitialProject,
  deriveDirectRoomConnections,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  type Level,
  type Opening,
  type Project,
  type Room
} from "@casastudio/schema";
import { describe, expect, it, vi } from "vitest";

import { deriveDesignContext, type DesignTarget } from "./index.js";

const target: DesignTarget = {
  kind: "room",
  projectId: "p",
  levelId: "l",
  roomId: "a"
};

function rectangle(id: string, x: number, z = 0): Room {
  const points = [
    { x, z },
    { x: x + 300, z },
    { x: x + 300, z: z + 300 },
    { x, z: z + 300 }
  ];
  return {
    id,
    name: `Space ${id}`,
    type: id === "b" ? "BEDROOM" : "STUDIO",
    boundary: points.map((start, index) => ({
      kind: "FREE" as const,
      start,
      end: points[(index + 1) % 4]!
    }))
  };
}

function project(type: Opening["type"] = "DOOR"): Project {
  const initial = createInitialProject({
    projectId: "p",
    buildingId: "building",
    levelId: "l",
    name: "Synthetic",
    createdAt: "2026-10-01T00:00:00.000Z"
  });
  const a = rectangle("a", 0);
  const b = rectangle("b", 300);
  a.boundary[1] = { wallId: "ab", direction: "FORWARD" };
  b.boundary[3] = { wallId: "ab", direction: "REVERSE" };
  const level: Level = {
    id: "l",
    name: "Ground",
    elevation: 0,
    rooms: [a, b],
    staircases: [],
    walls: [
      {
        id: "ab",
        start: { x: 300, z: 0 },
        end: { x: 300, z: 300 },
        height: 270,
        thickness: 15,
        roomIds: ["a", "b"],
        openings: [
          {
            id: "passage",
            type,
            offsetFromStart: 40,
            width: 100,
            height: 210,
            elevation: 0
          }
        ]
      }
    ]
  };
  return { ...initial, building: { ...initial.building, levels: [level] } };
}

function spaces(p: Project) {
  return deriveDesignContext(p, target).spatialContext.adjacentSpaces;
}

function addRightNeighbor(p: Project) {
  const level = p.building.levels[0]!;
  const b = level.rooms[1]!;
  const c = rectangle("c", 600);
  b.boundary[1] = { wallId: "bc", direction: "FORWARD" };
  c.boundary[3] = { wallId: "bc", direction: "REVERSE" };
  level.rooms.push(c);
  level.walls.push({
    ...level.walls[0]!,
    id: "bc",
    start: { x: 600, z: 0 },
    end: { x: 600, z: 300 },
    roomIds: ["b", "c"],
    openings: [
      {
        id: "bc-door",
        type: "DOOR",
        offsetFromStart: 40,
        width: 90,
        height: 210,
        elevation: 0
      }
    ]
  });
}

describe("canonical direct Room spatial context", () => {
  it.each(["DOOR", "OPENING"] as const)(
    "resolves a valid shared-Wall %s with identity and dimensions",
    (type) => {
      const p = project(type);
      expect(validateProjectReferenceConsistency(p).errors).toEqual([]);
      expect(validateProjectGeometry(p).errors).toEqual([]);
      expect(spaces(p)).toEqual([
        {
          room: {
            id: "b",
            name: "Space b",
            type: "BEDROOM",
            level: { id: "l", name: "Ground", elevation: 0 },
            floorElevation: 0
          },
          connections: [
            {
              kind: type === "DOOR" ? "door" : "wall-opening",
              wallId: "ab",
              openingId: "passage",
              width: 100,
              height: 210,
              offsetFromWallStart: 40,
              sillElevation: 0,
              targetBoundaryDirection: "FORWARD"
            }
          ]
        }
      ]);
    }
  );

  it("excludes Windows, solid Walls and unrelated nearby Rooms", () => {
    const p = project("WINDOW");
    p.building.levels[0]!.rooms.push(rectangle("nearby", 601));
    expect(spaces(p)).toEqual([]);
    p.building.levels[0]!.walls[0]!.openings = [];
    expect(spaces(p)).toEqual([]);
    p.building.levels[0]!.walls[0]!.openings =
      project().building.levels[0]!.walls[0]!.openings;
    expect(spaces(p).map((space) => space.room.id)).toEqual(["b"]);
  });

  it("does not infer passages from FREE overlap or endpoint contact", () => {
    const p = project();
    p.building.levels[0]!.walls = [];
    p.building.levels[0]!.rooms = [
      rectangle("a", 0),
      rectangle("b", 300),
      rectangle("touch", 300, 300)
    ];
    expect(spaces(p)).toEqual([]);
  });

  it("excludes overlapping other-Level Rooms and different floor strata", () => {
    const p = project();
    const level = p.building.levels[0]!;
    const b = level.rooms.pop()!;
    p.building.levels.push({
      ...level,
      id: "upper",
      elevation: 300,
      walls: [],
      rooms: [b]
    });
    expect(spaces(p)).toEqual([]);
    level.rooms.push(b);
    b.elevation = 150;
    expect(spaces(p)).toEqual([]);
  });

  it("excludes a shared opening entirely below the connected Room floors", () => {
    const p = project();
    p.building.levels[0]!.rooms.forEach((room) => {
      room.elevation = 220;
    });
    expect(spaces(p)).toEqual([]);
  });

  it("includes multiple direct neighbors deterministically without recursion", () => {
    const p = project();
    addRightNeighbor(p);
    const level = p.building.levels[0]!;
    expect(spaces(p).map((space) => space.room.id)).toEqual(["b"]);
    const d = rectangle("d", 0, 300);
    level.rooms[0]!.boundary[2] = { wallId: "ad", direction: "FORWARD" };
    d.boundary[0] = { wallId: "ad", direction: "REVERSE" };
    level.rooms.push(d);
    level.walls.push({
      ...level.walls[0]!,
      id: "ad",
      start: { x: 300, z: 300 },
      end: { x: 0, z: 300 },
      roomIds: ["a", "d"],
      openings: [
        {
          id: "ad-door",
          type: "DOOR",
          offsetFromStart: 40,
          width: 90,
          height: 210,
          elevation: 0
        }
      ]
    });
    expect(validateProjectReferenceConsistency(p).errors).toEqual([]);
    expect(validateProjectGeometry(p).errors).toEqual([]);
    const before = spaces(p);
    expect(before.map((space) => space.room.id)).toEqual(["b", "d"]);
    level.rooms.reverse();
    level.walls.reverse();
    expect(spaces(p)).toEqual(before);
  });

  it("deduplicates topology plus navigation evidence and groups distinct passages once", () => {
    const p = project();
    const wall = p.building.levels[0]!.walls[0]!;
    wall.openings[0] = {
      ...wall.openings[0]!,
      type: "DOOR",
      connectedRoomIds: ["b", "a"]
    };
    wall.openings.push({
      id: "second",
      type: "OPENING",
      offsetFromStart: 160,
      width: 100,
      height: 220,
      elevation: 0
    });
    expect(spaces(p)).toHaveLength(1);
    expect(spaces(p)[0]!.connections.map((item) => item.openingId)).toEqual([
      "passage",
      "second"
    ]);
  });

  it.each(
    [["a"], ["a", "missing"], ["a", "b", "c"]].map((connectedRoomIds) => ({
      connectedRoomIds
    }))
  )(
    "omits unresolved explicit Door metadata $connectedRoomIds",
    ({ connectedRoomIds }) => {
      const p = project();
      p.building.levels[0]!.walls[0]!.openings[0] = {
        ...p.building.levels[0]!.walls[0]!.openings[0]!,
        type: "DOOR",
        connectedRoomIds
      };
      expect(spaces(p)).toEqual([]);
    }
  );

  it("uses explicit Door topology without boundaries but rejects contradictory owners", () => {
    const p = project();
    const level = p.building.levels[0]!;
    level.rooms.forEach((room) => {
      room.boundary = [];
    });
    level.walls[0]!.roomIds = [];
    level.walls[0]!.openings[0] = {
      ...level.walls[0]!.openings[0]!,
      type: "DOOR",
      connectedRoomIds: ["a", "b"]
    };
    expect(spaces(p)).toHaveLength(1);
    level.rooms.push(rectangle("c", 600));
    level.walls[0]!.roomIds = ["c"];
    expect(spaces(p)).toEqual([]);
  });

  it("omits incomplete reciprocal ownership, same-side and non-manifold relationships", () => {
    const p = project("OPENING");
    const level = p.building.levels[0]!;
    level.rooms[1]!.boundary[3] = { wallId: "ab", direction: "FORWARD" };
    expect(spaces(p)).toEqual([]);
    level.rooms[1]!.boundary = [];
    expect(spaces(p)).toEqual([]);
    level.rooms[1]!.boundary = [{ wallId: "ab", direction: "REVERSE" }];
    level.rooms.push({
      ...rectangle("c", 300),
      boundary: [{ wallId: "ab", direction: "REVERSE" }]
    });
    level.walls[0]!.roomIds.push("c");
    expect(spaces(p)).toEqual([]);
  });

  it("works without a provider key and preserves the entire Project", () => {
    vi.stubEnv("OPENAI_API_KEY", undefined);
    try {
      const p = project();
      const before = structuredClone(p);
      expect(spaces(p)).toHaveLength(1);
      expect(
        deriveDirectRoomConnections(p.building.levels[0]!, "a")
      ).toHaveLength(1);
      expect(p).toEqual(before);
      expect(Object.isFrozen(spaces(p)[0]!.connections)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
