import { describe, expect, it } from "vitest";

import { StaircaseSchema } from "./staircase";

const validFlight = {
  id: "lower-flight",
  start: { x: 0, z: 225 },
  end: { x: 0, z: 385 },
  width: 62,
  stepCount: 4,
  startElevation: 0,
  endElevation: 110
};

const upperFlight = {
  id: "upper-flight",
  start: { x: 0, z: 385 },
  end: { x: 160, z: 385 },
  width: 62,
  stepCount: 4,
  startElevation: 110,
  endElevation: 220
};

const validLanding = {
  id: "stair-landing-1",
  position: { x: 0, z: 353 },
  width: 62,
  depth: 32,
  elevation: 110
};

const validStaircase = {
  id: "living-mezzanine-staircase",
  name: "Living Room to Mezzanine Staircase",
  fromLevelId: "ground-level",
  toLevelId: "upper-level",
  width: 62,
  flights: [validFlight, upperFlight],
  landings: [validLanding]
};

describe("StaircaseSchema", () => {
  it("accepts a valid staircase with two flights and one landing", () => {
    expect(StaircaseSchema.parse(validStaircase)).toEqual(validStaircase);
  });

  it("accepts a same-Level staircase", () => {
    expect(StaircaseSchema.safeParse({ ...validStaircase, toLevelId: "ground-level" }).success).toBe(true);
  });

  it("accepts optional Room references", () => {
    const staircaseWithRooms = {
      ...validStaircase,
      fromRoomId: "living-room",
      toRoomId: "mezzanine-studio"
    };

    expect(StaircaseSchema.parse(staircaseWithRooms).toRoomId).toBe("mezzanine-studio");
  });

  it("rejects zero width", () => {
    expect(StaircaseSchema.safeParse({ ...validStaircase, width: 0 }).success).toBe(false);
  });

  it("rejects undocumented fields", () => {
    expect(StaircaseSchema.safeParse({ ...validStaircase, direction: "UP" }).success).toBe(false);
  });

  it("requires the flights array", () => {
    expect(
      StaircaseSchema.safeParse({
        id: validStaircase.id,
        fromLevelId: validStaircase.fromLevelId,
        toLevelId: validStaircase.toLevelId,
        width: validStaircase.width,
        landings: validStaircase.landings
      }).success
    ).toBe(false);
  });

  it("requires the landings array", () => {
    expect(
      StaircaseSchema.safeParse({
        id: validStaircase.id,
        fromLevelId: validStaircase.fromLevelId,
        toLevelId: validStaircase.toLevelId,
        width: validStaircase.width,
        flights: validStaircase.flights
      }).success
    ).toBe(false);
  });
});
