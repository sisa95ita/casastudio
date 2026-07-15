import { describe, expect, it } from "vitest";

import { DoorSchema, OpeningSchema, WindowSchema } from "./opening";

const validDoor = {
  id: "living-door",
  type: "DOOR",
  offsetFromStart: 42,
  width: 80,
  height: 210,
  elevation: 0,
  connectedRoomIds: ["living-room", "corridor"]
};

const validWindow = {
  id: "main-window",
  name: "Main Window",
  type: "WINDOW",
  offsetFromStart: 220,
  width: 120,
  height: 165,
  elevation: 90
};

describe("DoorSchema", () => {
  it("accepts documented door properties", () => {
    expect(DoorSchema.parse(validDoor)).toEqual(validDoor);
  });

  it("rejects a door without required elevation", () => {
    expect(DoorSchema.safeParse({ ...validDoor, elevation: undefined }).success).toBe(false);
  });
});

describe("WindowSchema", () => {
  it("accepts documented window properties", () => {
    expect(WindowSchema.parse(validWindow)).toEqual(validWindow);
  });

  it("rejects door-only connectivity on windows", () => {
    expect(WindowSchema.safeParse({ ...validWindow, connectedRoomIds: ["living-room"] }).success).toBe(false);
  });
});

describe("OpeningSchema", () => {
  it("discriminates doors and windows by opening type", () => {
    expect(OpeningSchema.parse(validDoor).type).toBe("DOOR");
    expect(OpeningSchema.parse(validWindow).type).toBe("WINDOW");
  });

  it("rejects undocumented opening types", () => {
    expect(OpeningSchema.safeParse({ ...validWindow, type: "ARCH" }).success).toBe(false);
  });
});
