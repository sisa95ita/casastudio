import { describe, expect, it } from "vitest";

import {
  BuildingTypeSchema,
  OpeningTypeSchema,
  ProjectionTypeSchema,
  RenderStatusSchema,
  RoomTypeSchema
} from "./index";

describe("shared enum schemas", () => {
  it("validates documented building types", () => {
    expect(BuildingTypeSchema.parse("HOUSE")).toBe("HOUSE");
    expect(BuildingTypeSchema.safeParse("WAREHOUSE").success).toBe(false);
  });

  it("validates documented room types", () => {
    expect(RoomTypeSchema.parse("LIVING_ROOM")).toBe("LIVING_ROOM");
    expect(RoomTypeSchema.safeParse("MEZZANINE").success).toBe(false);
  });

  it("validates documented opening types", () => {
    expect(OpeningTypeSchema.parse("WINDOW")).toBe("WINDOW");
    expect(OpeningTypeSchema.safeParse("ARCH").success).toBe(false);
  });

  it("validates documented projection types", () => {
    expect(ProjectionTypeSchema.parse("PERSPECTIVE")).toBe("PERSPECTIVE");
    expect(ProjectionTypeSchema.safeParse("PANORAMIC").success).toBe(false);
  });

  it("validates documented render statuses", () => {
    expect(RenderStatusSchema.parse("SUCCEEDED")).toBe("SUCCEEDED");
    expect(RenderStatusSchema.safeParse("QUEUED").success).toBe(false);
  });
});
