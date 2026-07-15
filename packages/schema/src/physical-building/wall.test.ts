import { describe, expect, it } from "vitest";

import { WallSchema } from "./wall";

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
