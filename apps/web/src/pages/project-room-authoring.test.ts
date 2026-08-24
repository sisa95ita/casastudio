import { classifyLevelRoomTopology, type Project, type Wall } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../test/demo-project-fixture";
import {
  collectActionableRoomFaces,
  commitRoomFaceCandidate
} from "./project-room-authoring";

describe("Room authoring candidates", () => {
  it("commits the clicked face when multiple unassigned candidates exist", () => {
    const project = createTwoFaceProject(false);
    const topology = classifyLevelRoomTopology(project, "ground-floor");
    const candidates = collectActionableRoomFaces(topology);
    expect(candidates).toHaveLength(2);
    const clicked = candidates[1]!;

    const commit = commitRoomFaceCandidate(
      project,
      "ground-floor",
      clicked.key,
      () => "clicked-room"
    );

    expect(commit?.face.key).toBe(clicked.key);
    expect(commit?.result.ok).toBe(true);
    if (!commit?.result.ok) return;
    expect(commit.result.project.building.levels[0]?.rooms).toEqual([
      expect.objectContaining({
        id: "clicked-room",
        boundary: clicked.boundary
      })
    ]);
    expect(
      collectActionableRoomFaces(
        classifyLevelRoomTopology(commit.result.project, "ground-floor")
      ).map((face) => face.key)
    ).not.toContain(clicked.key);
  });

  it("preserves an irregular candidate's exact ordered boundary", () => {
    const project = createIrregularProject();
    const candidate = collectActionableRoomFaces(
      classifyLevelRoomTopology(project, "ground-floor")
    )[0]!;

    const commit = commitRoomFaceCandidate(
      project,
      "ground-floor",
      candidate.key,
      () => "irregular-room"
    );

    expect(commit?.result.ok).toBe(true);
    if (!commit?.result.ok) return;
    expect(commit.result.project.building.levels[0]?.rooms[0]?.boundary).toEqual(
      candidate.boundary
    );
    expect(candidate.vertices).toHaveLength(5);
  });

  it("offers only the new identity face for a Room subdivision", () => {
    const project = createTwoFaceProject(true);
    const topology = classifyLevelRoomTopology(project, "ground-floor");
    expect(topology.subdivisions).toHaveLength(1);
    const subdivision = topology.subdivisions[0]!;
    const candidates = collectActionableRoomFaces(topology);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.key).not.toBe(subdivision.preservedFaceKey);
    const commit = commitRoomFaceCandidate(
      project,
      "ground-floor",
      candidates[0]!.key,
      () => "subdivision-room"
    );
    expect(commit?.result.ok).toBe(true);
    if (!commit?.result.ok) return;
    expect(commit.result.project.building.levels[0]?.rooms).toHaveLength(2);
    expect(
      commit.result.project.building.levels[0]?.rooms.find(
        (room) => room.id === "subdivision-room"
      )?.boundary
    ).toEqual(candidates[0]?.boundary);
  });
});

function createTwoFaceProject(withRoom: boolean): Project {
  const walls = [
    wall("bottom-left", 0, 0, 100, 0),
    wall("bottom-right", 100, 0, 200, 0),
    wall("right", 200, 0, 200, 100),
    wall("top-right", 200, 100, 100, 100),
    wall("top-left", 100, 100, 0, 100),
    wall("left", 0, 100, 0, 0),
    wall("shared", 100, 0, 100, 100)
  ];
  const project = structuredClone(demoProjectFixture);
  project.viewpoints = [];
  project.building.levels = [{
    ...project.building.levels[0]!,
    id: "ground-floor",
    walls: withRoom
      ? walls.map((candidate) => ({
          ...candidate,
          roomIds: candidate.id === "shared" ? [] : ["whole-room"]
        }))
      : walls,
    rooms: withRoom
      ? [{
          id: "whole-room",
          name: "Whole Room",
          type: "OTHER",
          boundary: [
            "bottom-left",
            "bottom-right",
            "right",
            "top-right",
            "top-left",
            "left"
          ].map((wallId) => ({ wallId, direction: "FORWARD" as const }))
        }]
      : [],
    staircases: []
  }];
  return project;
}

function createIrregularProject(): Project {
  const project = structuredClone(demoProjectFixture);
  project.viewpoints = [];
  project.building.levels = [{
    ...project.building.levels[0]!,
    id: "ground-floor",
    walls: [
      wall("a", 0, 0, 160, 0),
      wall("b", 160, 0, 210, 80),
      wall("c", 210, 80, 90, 150),
      wall("d", 90, 150, 0, 100),
      wall("e", 0, 100, 0, 0)
    ],
    rooms: [],
    staircases: []
  }];
  return project;
}

function wall(
  id: string,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
): Wall {
  return {
    id,
    start: { x: startX, z: startZ },
    end: { x: endX, z: endZ },
    height: 280,
    thickness: 18,
    roomIds: [],
    openings: []
  };
}
