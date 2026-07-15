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

const validStaircase = {
  id: "living-mezzanine-staircase",
  fromLevelId: "ground-level",
  toLevelId: "ground-level",
  width: 62,
  flights: [
    {
      id: "short-flight",
      start: { x: 0, z: 225 },
      end: { x: 0, z: 385 },
      width: 62,
      stepCount: 4,
      startElevation: 0,
      endElevation: 110
    }
  ],
  landings: [
    {
      id: "stair-landing-1",
      position: { x: 0, z: 353 },
      width: 62,
      depth: 32,
      elevation: 110
    }
  ]
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

  it("accepts empty staircases", () => {
    expect(LevelSchema.parse({ ...validLevel, staircases: [] }).staircases).toEqual([]);
  });

  it("accepts one valid Staircase", () => {
    expect(LevelSchema.parse({ ...validLevel, staircases: [validStaircase] }).staircases).toHaveLength(1);
  });

  it("fails when a Staircase is invalid", () => {
    expect(LevelSchema.safeParse({ ...validLevel, staircases: [{ ...validStaircase, width: 0 }] }).success).toBe(false);
  });
});
