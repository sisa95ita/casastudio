import { describe, expect, it } from "vitest";
import { createOrientedRectangleFootprint } from "./plan-footprints-2d";
import { placeRoomLabel2D } from "./room-label-layout-2d";

const room = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 200 },
  { x: 0, y: 200 }
];
const base = {
  preferredAnchor: { x: 100, y: 100 },
  roomPolygon: room,
  roomName: "Living Room",
  formattedArea: "40.00 m²",
  furnitureFootprints: [],
  stairFootprints: [],
  occupiedLabelBounds: []
};

describe("Room label layout", () => {
  it("retains an unobstructed preferred anchor deterministically", () => {
    const first = placeRoomLabel2D(base);
    const second = placeRoomLabel2D(base);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ anchor: base.preferredAnchor, fallback: false });
  });

  it("moves inside its Room when Furniture covers the preferred anchor", () => {
    const placement = placeRoomLabel2D({
      ...base,
      furnitureFootprints: [[
        { x: 94, y: 94 },
        { x: 106, y: 94 },
        { x: 106, y: 106 },
        { x: 94, y: 106 }
      ]]
    });
    expect(placement.anchor).not.toEqual(base.preferredAnchor);
    expect(placement.fallback).toBe(false);
    expect(placement.bounds.left).toBeGreaterThanOrEqual(0);
    expect(placement.bounds.right).toBeLessThanOrEqual(200);
    expect(placement.bounds.top).toBeGreaterThanOrEqual(0);
    expect(placement.bounds.bottom).toBeLessThanOrEqual(200);
  });

  it("uses rotated Furniture occupancy and prefers avoiding Stairs", () => {
    const rotated = createOrientedRectangleFootprint(
      { x: 100, z: 100 },
      18,
      50,
      45
    ).map((point) => ({ x: point.x, y: point.z }));
    const furniturePlacement = placeRoomLabel2D({
      ...base,
      furnitureFootprints: [rotated]
    });
    const stairPlacement = placeRoomLabel2D({
      ...base,
      stairFootprints: [rotated]
    });
    expect(furniturePlacement.anchor).not.toEqual(base.preferredAnchor);
    expect(stairPlacement.anchor).not.toEqual(base.preferredAnchor);
  });

  it("keeps the readable deterministic fallback when no candidate fits", () => {
    const placement = placeRoomLabel2D({
      ...base,
      roomPolygon: [
        { x: 90, y: 90 },
        { x: 110, y: 90 },
        { x: 110, y: 110 },
        { x: 90, y: 110 }
      ],
      furnitureFootprints: [room]
    });
    expect(placement).toMatchObject({
      anchor: base.preferredAnchor,
      fallback: true
    });
  });
});
