import { describe, expect, it } from "vitest";

import {
  BaseImageSchema,
  BuildingSchema,
  IdentifierSchema,
  OpeningSchema,
  Point2DSchema,
  RoomSchema,
  StairFlightSchema,
  StairLandingSchema,
  StaircaseSchema,
  UnitsSchema,
  ViewpointSchema,
  type BaseImage,
  type StairFlight,
  type StairLanding,
  type Staircase,
  type Viewpoint
} from "./index";

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

  it("exports staircase schemas and inferred types from the package entry point", () => {
    const flight: StairFlight = {
      id: "short-flight",
      start: { x: 0, z: 225 },
      end: { x: 0, z: 385 },
      width: 62,
      stepCount: 4,
      startElevation: 0,
      endElevation: 110
    };
    const landing: StairLanding = {
      id: "stair-landing-1",
      position: { x: 0, z: 353 },
      width: 62,
      depth: 32,
      elevation: 110
    };
    const staircase: Staircase = {
      id: "living-mezzanine-staircase",
      fromLevelId: "ground-level",
      toLevelId: "ground-level",
      width: 62,
      flights: [flight],
      landings: [landing]
    };

    expect(StairFlightSchema.parse(flight)).toEqual(flight);
    expect(StairLandingSchema.parse(landing)).toEqual(landing);
    expect(StaircaseSchema.parse(staircase)).toEqual(staircase);
  });

  it("exports observation schemas and inferred types from the package entry point", () => {
    const viewpoint: Viewpoint = {
      id: "living-tv-view",
      levelId: "ground-level",
      roomId: "living-room",
      cameraPosition: { x: 250, y: 165, z: 320 },
      cameraTarget: { x: 250, y: 120, z: 120 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    };
    const baseImage: BaseImage = {
      id: "base-image-living-tv-001",
      viewpointId: "living-tv-view",
      assetRef: "assets/base-images/living-tv-001.png",
      projectRevision: 3,
      createdAt: "2026-07-11T16:00:00+02:00"
    };

    expect(ViewpointSchema.parse(viewpoint)).toEqual(viewpoint);
    expect(BaseImageSchema.parse(baseImage)).toEqual(baseImage);
  });
});
