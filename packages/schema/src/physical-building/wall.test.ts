import { describe, expect, it } from "vitest";

import { WallSchema } from "./wall.js";

const validWall = {
  id: "living-wall-tv",
  name: "TV Wall",
  start: { x: 0, z: 0 },
  end: { x: 488, z: 0 },
  height: 390,
  thickness: 15,
  roomIds: ["living-room"],
  openings: []
};

describe("WallSchema", () => {
  it("accepts documented wall properties", () => {
    expect(WallSchema.parse(validWall)).toEqual(validWall);
  });

  it("accepts wall openings", () => {
    const wallWithOpening = {
      ...validWall,
      openings: [
        {
          id: "main-window",
          type: "WINDOW",
          offsetFromStart: 220,
          width: 120,
          height: 165,
          elevation: 90
        }
      ]
    };

    expect(WallSchema.parse(wallWithOpening).openings).toHaveLength(1);
  });

  it("accepts zero room IDs", () => {
    expect(WallSchema.parse({ ...validWall, roomIds: [] }).roomIds).toEqual([]);
  });

  it("accepts one room ID", () => {
    expect(WallSchema.parse({ ...validWall, roomIds: ["living-room"] }).roomIds).toEqual(["living-room"]);
  });

  it("accepts two unique room IDs", () => {
    expect(WallSchema.parse({ ...validWall, roomIds: ["living-room", "corridor"] }).roomIds).toEqual([
      "living-room",
      "corridor"
    ]);
  });

  it("rejects three room IDs", () => {
    expect(WallSchema.safeParse({ ...validWall, roomIds: ["living-room", "corridor", "kitchen"] }).success).toBe(
      false
    );
  });

  it("rejects duplicate room IDs", () => {
    expect(WallSchema.safeParse({ ...validWall, roomIds: ["living-room", "living-room"] }).success).toBe(false);
  });

  it("requires positive wall height and thickness", () => {
    expect(WallSchema.safeParse({ ...validWall, height: 0 }).success).toBe(false);
    expect(WallSchema.safeParse({ ...validWall, thickness: -1 }).success).toBe(false);
  });

  it("rejects zero-length walls", () => {
    expect(WallSchema.safeParse({ ...validWall, end: { x: 0, z: 0 } }).success).toBe(false);
  });

  it("rejects undocumented wall fields", () => {
    expect(WallSchema.safeParse({ ...validWall, levelId: "ground-level" }).success).toBe(false);
  });
});
