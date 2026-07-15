import { describe, expect, it } from "vitest";

import { BuildingSchema, IdentifierSchema, OpeningSchema, Point2DSchema, RoomSchema, UnitsSchema } from "./index";

describe("package barrel exports", () => {
  it("exports shared schemas from the package entry point", () => {
    expect(IdentifierSchema.parse("casa-simone")).toBe("casa-simone");
    expect(Point2DSchema.parse({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
    expect(UnitsSchema.parse({ length: "cm", angle: "deg" })).toEqual({ length: "cm", angle: "deg" });
    expect(BuildingSchema.parse({ id: "main-building", name: "Main Building", type: "HOUSE", levels: [] }).id).toBe(
      "main-building"
    );
    expect(RoomSchema.parse({ id: "living-room", name: "Living Room", type: "LIVING_ROOM", wallIds: [] }).id).toBe(
      "living-room"
    );
    expect(
      OpeningSchema.parse({
        id: "main-window",
        type: "WINDOW",
        offsetFromStart: 220,
        width: 120,
        height: 165,
        elevation: 90
      }).type
    ).toBe("WINDOW");
  });
});
