import { describe, expect, it } from "vitest";

import { RoomSchema } from "./room";

const validRoom = {
  id: "living-room",
  name: "Living Room",
  type: "LIVING_ROOM",
  wallIds: ["living-wall-tv"]
};

describe("RoomSchema", () => {
  it("accepts documented room properties", () => {
    expect(RoomSchema.parse(validRoom)).toEqual(validRoom);
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

  it("rejects missing wallIds", () => {
    expect(RoomSchema.safeParse({ id: "living-room", name: "Living Room", type: "LIVING_ROOM" }).success).toBe(
      false
    );
  });
});
