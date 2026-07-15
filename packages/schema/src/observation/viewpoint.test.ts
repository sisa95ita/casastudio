import { describe, expect, it } from "vitest";

import { ViewpointSchema } from "./viewpoint";

const validViewpoint = {
  id: "living-tv-view",
  name: "Living Room TV View",
  levelId: "ground-level",
  roomId: "living-room",
  cameraPosition: { x: 250, y: 165, z: 320 },
  cameraTarget: { x: 250, y: 120, z: 120 },
  fieldOfView: 60,
  projection: "PERSPECTIVE"
};

describe("ViewpointSchema", () => {
  it("accepts a valid perspective Viewpoint associated with a Room", () => {
    expect(ViewpointSchema.parse(validViewpoint)).toEqual(validViewpoint);
  });

  it("accepts a valid Level-scoped Viewpoint without roomId", () => {
    const levelScopedViewpoint = {
      id: "ground-level-overview",
      levelId: "ground-level",
      cameraPosition: { x: 300, y: 180, z: 500 },
      cameraTarget: { x: 300, y: 120, z: 100 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    };

    expect(ViewpointSchema.parse(levelScopedViewpoint)).toEqual(levelScopedViewpoint);
  });

  it("accepts a valid orthographic Viewpoint", () => {
    expect(ViewpointSchema.safeParse({ ...validViewpoint, projection: "ORTHOGRAPHIC" }).success).toBe(true);
  });

  it("rejects zero fieldOfView", () => {
    expect(ViewpointSchema.safeParse({ ...validViewpoint, fieldOfView: 0 }).success).toBe(false);
  });

  it("rejects negative fieldOfView", () => {
    expect(ViewpointSchema.safeParse({ ...validViewpoint, fieldOfView: -1 }).success).toBe(false);
  });

  it("rejects fieldOfView equal to or greater than 180", () => {
    expect(ViewpointSchema.safeParse({ ...validViewpoint, fieldOfView: 180 }).success).toBe(false);
    expect(ViewpointSchema.safeParse({ ...validViewpoint, fieldOfView: 181 }).success).toBe(false);
  });

  it("rejects identical cameraPosition and cameraTarget", () => {
    expect(
      ViewpointSchema.safeParse({
        ...validViewpoint,
        cameraTarget: validViewpoint.cameraPosition
      }).success
    ).toBe(false);
  });

  it("rejects undocumented fields", () => {
    expect(ViewpointSchema.safeParse({ ...validViewpoint, orthographicScale: 100 }).success).toBe(false);
  });

  it("requires levelId", () => {
    expect(
      ViewpointSchema.safeParse({
        id: validViewpoint.id,
        cameraPosition: validViewpoint.cameraPosition,
        cameraTarget: validViewpoint.cameraTarget,
        fieldOfView: validViewpoint.fieldOfView,
        projection: validViewpoint.projection
      }).success
    ).toBe(false);
  });

  it("keeps roomId optional", () => {
    expect(ViewpointSchema.safeParse({ ...validViewpoint, roomId: undefined }).success).toBe(true);
  });
});
