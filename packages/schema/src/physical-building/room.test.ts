import { describe, expect, it } from "vitest";

import { RoomSchema } from "./room";

const northBoundaryEdge = { wallId: "living-wall-north", direction: "FORWARD" };
const eastBoundaryEdge = { wallId: "living-wall-east", direction: "FORWARD" };
const southBoundaryEdge = { wallId: "living-wall-south", direction: "FORWARD" };

const validRoom = {
  id: "living-room",
  name: "Living Room",
  type: "LIVING_ROOM",
  boundary: [northBoundaryEdge, eastBoundaryEdge, southBoundaryEdge]
};

describe("RoomSchema", () => {
  it("accepts documented room properties", () => {
    expect(RoomSchema.parse(validRoom)).toEqual(validRoom);
  });

  it("accepts an empty draft boundary", () => {
    const draftRoom = { ...validRoom, boundary: [] };

    expect(RoomSchema.parse(draftRoom)).toEqual(draftRoom);
  });

  it("accepts optional local elevation", () => {
    expect(RoomSchema.parse({ ...validRoom, elevation: 195 }).elevation).toBe(195);
  });

  it("omits elevation when the semantic value is zero by default", () => {
    expect(RoomSchema.parse(validRoom)).not.toHaveProperty("elevation");
  });

  it("rejects hierarchy owner references", () => {
    expect(RoomSchema.safeParse({ ...validRoom, buildingId: "main-building" }).success).toBe(false);
    expect(RoomSchema.safeParse({ ...validRoom, levelId: "ground-level" }).success).toBe(false);
  });

  it("rejects missing boundary", () => {
    expect(RoomSchema.safeParse({ id: "living-room", name: "Living Room", type: "LIVING_ROOM" }).success).toBe(
      false
    );
  });

  it("rejects legacy wallIds", () => {
    expect(RoomSchema.safeParse({ ...validRoom, wallIds: ["living-wall-north"] }).success).toBe(false);
  });

  it("rejects one-edge boundaries", () => {
    expect(RoomSchema.safeParse({ ...validRoom, boundary: validRoom.boundary.slice(0, 1) }).success).toBe(false);
  });

  it("rejects two-edge boundaries", () => {
    expect(RoomSchema.safeParse({ ...validRoom, boundary: validRoom.boundary.slice(0, 2) }).success).toBe(false);
  });

  it("rejects invalid boundary directions", () => {
    expect(
      RoomSchema.safeParse({
        ...validRoom,
        boundary: [{ ...northBoundaryEdge, direction: "SIDEWAYS" }, eastBoundaryEdge, southBoundaryEdge]
      }).success
    ).toBe(false);
  });

  it("rejects duplicate wall IDs within one boundary", () => {
    expect(
      RoomSchema.safeParse({
        ...validRoom,
        boundary: [
          northBoundaryEdge,
          { ...eastBoundaryEdge, wallId: northBoundaryEdge.wallId },
          southBoundaryEdge
        ]
      }).success
    ).toBe(false);
  });
});
