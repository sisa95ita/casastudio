import { describe, expect, it } from "vitest";

import { BuildingSchema } from "./building";

const validBuilding = {
  id: "main-building",
  name: "Main Building",
  type: "HOUSE",
  levels: []
};

describe("BuildingSchema", () => {
  it("accepts documented building properties", () => {
    expect(BuildingSchema.parse(validBuilding)).toEqual(validBuilding);
  });

  it("accepts nested levels", () => {
    const building = {
      ...validBuilding,
      levels: [
        {
          id: "ground-level",
          name: "Ground Level",
          elevation: 0,
          rooms: [],
          walls: [],
          staircases: []
        }
      ]
    };

    expect(BuildingSchema.parse(building).levels).toHaveLength(1);
  });

  it("rejects undocumented building fields", () => {
    expect(BuildingSchema.safeParse({ ...validBuilding, address: "Undocumented" }).success).toBe(false);
  });

  it("rejects undocumented building types", () => {
    expect(BuildingSchema.safeParse({ ...validBuilding, type: "WAREHOUSE" }).success).toBe(false);
  });
});
