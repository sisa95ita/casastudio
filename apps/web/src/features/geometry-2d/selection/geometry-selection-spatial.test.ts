import { describe, expect, it } from "vitest";

import {
  createGeometrySelectionBox,
  cycleGeometryHitCandidate,
  getGeometryHitCandidates,
  selectGeometryFootprintsInBox,
  sortGeometrySelectionFootprints,
  type GeometrySelectionFootprint
} from "./geometry-selection-spatial";

const square = (minX: number, minZ: number, maxX: number, maxZ: number) => [
  { x: minX, z: minZ },
  { x: maxX, z: minZ },
  { x: maxX, z: maxZ },
  { x: minX, z: maxZ }
];

const footprints: readonly GeometrySelectionFootprint[] = [
  {
    selection: { kind: "WALL", geometryId: "wall" },
    polygons: [square(1, 1, 4, 2)]
  },
  {
    selection: { kind: "OPENING", geometryId: "opening" },
    polygons: [square(2, 1, 3, 2)]
  },
  {
    selection: { kind: "POLYGON", geometryId: "room" },
    polygons: [square(0, 0, 10, 10)]
  },
  {
    selection: { kind: "FURNITURE", geometryId: "furniture" },
    polygons: [square(7, 7, 9, 9)]
  },
  {
    selection: { kind: "STAIRCASE", geometryId: "stair" },
    polygons: [square(4, 4, 6, 8)]
  }
];

describe("CAD geometry selection", () => {
  it("uses containment for left-to-right boxes across representative entities", () => {
    const box = createGeometrySelectionBox(
      { x: 0.5, z: 0.5 },
      { x: 6.5, z: 8.5 },
      true
    );
    expect(selectGeometryFootprintsInBox(footprints, box)).toEqual([
      { kind: "WALL", geometryId: "wall" },
      { kind: "OPENING", geometryId: "opening" },
      { kind: "STAIRCASE", geometryId: "stair" }
    ]);
  });

  it("uses crossing for right-to-left boxes, including Room edge intersections", () => {
    const box = createGeometrySelectionBox(
      { x: 6.5, z: 1.5 },
      { x: 3.5, z: 5 },
      false
    );
    expect(selectGeometryFootprintsInBox(footprints, box)).toEqual([
      { kind: "WALL", geometryId: "wall" },
      { kind: "POLYGON", geometryId: "room" },
      { kind: "STAIRCASE", geometryId: "stair" }
    ]);
  });

  it("uses architectural footprints for every representative selectable type", () => {
    const box = createGeometrySelectionBox(
      { x: -1, z: -1 },
      { x: 11, z: 11 },
      true
    );
    expect(selectGeometryFootprintsInBox(footprints, box)).toEqual(
      footprints.map((footprint) => footprint.selection)
    );
  });

  it("orders overlapping hits by product precedence and cycles stably", () => {
    const ordered = sortGeometrySelectionFootprints(footprints);
    const candidates = getGeometryHitCandidates(ordered, { x: 2.5, z: 1.5 });
    expect(candidates).toEqual([
      { kind: "OPENING", geometryId: "opening" },
      { kind: "WALL", geometryId: "wall" },
      { kind: "POLYGON", geometryId: "room" }
    ]);
    const first = cycleGeometryHitCandidate(
      undefined,
      { x: 20, y: 20 },
      candidates
    );
    const second = cycleGeometryHitCandidate(
      first.state,
      { x: 21, y: 20 },
      candidates
    );
    const third = cycleGeometryHitCandidate(
      second.state,
      { x: 21, y: 20 },
      candidates
    );
    const wrapped = cycleGeometryHitCandidate(
      third.state,
      { x: 21, y: 20 },
      candidates
    );
    expect([
      first.selection,
      second.selection,
      third.selection,
      wrapped.selection
    ]).toEqual([candidates[0], candidates[1], candidates[2], candidates[0]]);
  });

  it("resets overlap cycling when the click location or candidate set changes", () => {
    const candidates = getGeometryHitCandidates(
      sortGeometrySelectionFootprints(footprints),
      { x: 2.5, z: 1.5 }
    );
    const first = cycleGeometryHitCandidate(
      undefined,
      { x: 20, y: 20 },
      candidates
    );
    expect(
      cycleGeometryHitCandidate(first.state, { x: 30, y: 20 }, candidates)
        .selection
    ).toEqual(candidates[0]);
    expect(
      cycleGeometryHitCandidate(
        first.state,
        { x: 20, y: 20 },
        candidates.slice(1)
      ).selection
    ).toEqual(candidates[1]);
  });

  it("cycles stacked Furniture over Rooms and Staircases over Rooms deterministically", () => {
    const stacked = sortGeometrySelectionFootprints([
      {
        selection: { kind: "POLYGON", geometryId: "room" },
        polygons: [square(0, 0, 10, 10)]
      },
      {
        selection: { kind: "FURNITURE", geometryId: "chair-b" },
        polygons: [square(2, 2, 4, 4)]
      },
      {
        selection: { kind: "FURNITURE", geometryId: "chair-a" },
        polygons: [square(2, 2, 4, 4)]
      }
    ]);
    expect(getGeometryHitCandidates(stacked, { x: 3, z: 3 })).toEqual([
      { kind: "FURNITURE", geometryId: "chair-a" },
      { kind: "FURNITURE", geometryId: "chair-b" },
      { kind: "POLYGON", geometryId: "room" }
    ]);

    const stairAndRoom = sortGeometrySelectionFootprints([
      {
        selection: { kind: "POLYGON", geometryId: "room" },
        polygons: [square(0, 0, 10, 10)]
      },
      {
        selection: { kind: "STAIRCASE", geometryId: "stair" },
        polygons: [square(4, 4, 6, 8)]
      }
    ]);
    expect(getGeometryHitCandidates(stairAndRoom, { x: 5, z: 5 })).toEqual([
      { kind: "STAIRCASE", geometryId: "stair" },
      { kind: "POLYGON", geometryId: "room" }
    ]);
  });
});
