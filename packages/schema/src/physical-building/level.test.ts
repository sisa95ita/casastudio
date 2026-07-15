import { describe, expect, it } from "vitest";

import { LevelSchema } from "./level";

const validLevel = {
  id: "ground-level",
  name: "Ground Level",
  elevation: 0,
  rooms: [],
  walls: [],
  staircases: []
};

describe("LevelSchema", () => {
  it("accepts documented level properties", () => {
    expect(LevelSchema.parse(validLevel)).toEqual(validLevel);
  });

  it("accepts empty collections while editing", () => {
    const parsed = LevelSchema.parse(validLevel);

    expect(parsed.rooms).toEqual([]);
    expect(parsed.walls).toEqual([]);
    expect(parsed.staircases).toEqual([]);
  });

  it("rejects missing always-present collections", () => {
    expect(LevelSchema.safeParse({ id: "ground-level", name: "Ground Level", elevation: 0 }).success).toBe(false);
  });

  it("keeps staircases as an empty placeholder collection", () => {
    expect(LevelSchema.safeParse({ ...validLevel, staircases: [{ id: "stairs" }] }).success).toBe(false);
  });
});
