import { describe, expect, it } from "vitest";
import { createWall3D } from "../model/architectural-scene-3d-model";
import { createRoomReferencePlans3D } from "./room-reference-camera-3d";
import {
  generateInteriorCandidates3D,
  isSafeInteriorEye3D,
  planRoomInteriors3D
} from "./room-interior-planner-3d";
import {
  analyzeInteriorVisibility3D,
  createInteriorVisibilityScene3D,
  type InteriorVisibility3D
} from "./room-interior-visibility-3d";
import {
  interiorComplementTerms3D,
  interiorPoseDifference3D,
  interiorScoreTerms3D,
  scoreInteriorComplement3D,
  scoreInteriorOverview3D
} from "./room-interior-score-3d";
import { roomInteriorCameraPolicy3D as policy } from "./room-interior-policy-3d";
import {
  syntheticInteriorBounds3D as bounds,
  syntheticInteriorCandidate3D as camera,
  syntheticInteriorFloor3D as floor,
  syntheticInteriorItem3D as item,
  syntheticInteriorWalls3D as walls,
  syntheticInteriorWall3D as wall
} from "./room-interior-test-fixtures-3d";

describe("Layout-aware interior overview and complementary evidence", () => {
  const room = floor();
  const furniture = [
    item("one", 1.3, 3.8, 1.5, 1.2),
    item("two", 5.7, 3.6, 1.1, 0.8, 1.2),
    item("three", 5.8, 1.2, 0.6, 0.7)
  ];
  const plan = () =>
    planRoomInteriors3D(
      room,
      walls(room),
      furniture,
      [],
      bounds(room),
      4 / 3,
      2.8
    )!;
  it("selects a useful multi-item overview over a clearly inferior close-up", () => {
    const result = plan();
    const scene = createInteriorVisibilityScene3D(room, walls(room), furniture);
    const inferior = camera(5.8, 2.05, 5.8, 1.2);
    const badVisibility = analyzeInteriorVisibility3D(scene, inferior, 4 / 3);
    const badTerms = interiorScoreTerms3D(badVisibility, inferior);
    expect(result.first.terms.instances).toBeGreaterThanOrEqual(2 / 3);
    expect(result.first.terms.coverage).toBeGreaterThan(badTerms.coverage);
    expect(result.first.terms.diversity).toBeGreaterThan(badTerms.diversity);
    expect(result.first.score).toBeGreaterThan(
      scoreInteriorOverview3D(badTerms)
    );
  });
  it("uses B to improve the least represented item in A, with a meaningful pose difference", () => {
    const result = plan();
    const poorest = [...result.first.visibility.furniture].sort(
      (a, b) => a.coverage - b.coverage
    )[0]!;
    expect(poorest.coverage).toBeLessThan(0.9);
    const secondCoverage = result.second.visibility.furniture.find(
      (f) => f.id === poorest.id
    )!.coverage;
    expect(secondCoverage).toBeGreaterThan(poorest.coverage + 0.15);
    expect(
      interiorPoseDifference3D(result.first.candidate, result.second.candidate)
        .position
    ).toBeGreaterThanOrEqual(policy.minimumPositionDifference);
    expect(
      interiorPoseDifference3D(result.first.candidate, result.second.candidate)
        .direction
    ).toBeGreaterThanOrEqual(policy.minimumDirectionDifferenceDegrees);
  });
  it("enforces camera safety, moderate FOV, human eye height, and limited pitch", () => {
    const result = plan();
    const scene = createInteriorVisibilityScene3D(room, walls(room), furniture);
    for (const entry of [result.first, result.second]) {
      const c = entry.candidate,
        eye = c.pose.position;
      expect(isSafeInteriorEye3D(eye, room, scene)).toBe(true);
      expect(eye.y).toBeCloseTo(1.7);
      expect(policy.verticalFovs).toContain(c.verticalFovDegrees);
      const pitch =
        (Math.atan2(
          eye.y - c.pose.target.y,
          Math.hypot(eye.x - c.pose.target.x, eye.z - c.pose.target.z)
        ) *
          180) /
        Math.PI;
      expect(pitch).toBeGreaterThanOrEqual(0);
      expect(pitch).toBeLessThanOrEqual(
        policy.maximumDownwardPitchDegrees + 1e-9
      );
      expect(c.pose.near).toBeLessThan(policy.solidClearance);
    }
    expect(isSafeInteriorEye3D({ x: 1.3, y: 1.7, z: 3.8 }, room, scene)).toBe(
      false
    );
    expect(isSafeInteriorEye3D({ x: 0.05, y: 1.7, z: 2 }, room, scene)).toBe(
      false
    );
  });
  it("targets the occupied layout as well as room geometry without category rules", () => {
    const scene = createInteriorVisibilityScene3D(
      room,
      [],
      [item("one", 5.5, 3.8)]
    );
    const candidates = generateInteriorCandidates3D(
      room,
      scene,
      bounds(room),
      2.8
    );
    expect(
      candidates.some((c) => c.pose.target.x > 4.5 && c.pose.target.z > 3)
    ).toBe(true);
    const renamed = scene.furniture.map((f) => ({
      ...f,
      category: "UNRELATED",
      name: "Different",
      definitionId: "other"
    }));
    expect(
      planRoomInteriors3D(
        room,
        [],
        scene.furniture,
        [],
        bounds(room),
        4 / 3,
        2.8
      )?.first.candidate
    ).toEqual(
      planRoomInteriors3D(room, [], renamed, [], bounds(room), 4 / 3, 2.8)
        ?.first.candidate
    );
  });
  it("adapts to a low ceiling without putting the eye above it or inventing an impossible view", () => {
    const scene = createInteriorVisibilityScene3D(room, [], []);
    const candidates = generateInteriorCandidates3D(
      room,
      scene,
      bounds(room),
      1.8
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.pose.position.y).toBeCloseTo(1.5);
      expect(candidate.pose.target.y).toBeLessThanOrEqual(
        candidate.pose.position.y
      );
    }
    expect(
      generateInteriorCandidates3D(room, scene, bounds(room), 1.3)
    ).toEqual([]);
    const lowWalls = walls(room).map((w) => ({ ...w, height: 1.8 }));
    const model = {
      sourceProjectId: "synthetic",
      levels: [
        {
          id: "level",
          name: "Level",
          elevation: 0,
          y: 0,
          segments: [],
          floors: [room],
          walls: lowWalls,
          furniture: [],
          staircases: []
        }
      ]
    };
    const references = createRoomReferencePlans3D(model, {
      kind: "room",
      projectId: "synthetic",
      levelId: "level",
      roomId: "room"
    });
    expect(references).toHaveLength(3);
    for (const reference of references.slice(1))
      expect(reference.pose.position.y).toBeCloseTo(1.5);
  });
  it.each([
    { items: [] },
    { items: [item("single", 3, 3)] },
    { items: [item("sparse", 1, 4, 0.4, 0.6)] }
  ])("degrades gracefully for empty/single/sparse rooms (%#)", ({ items }) => {
    const result = planRoomInteriors3D(
      room,
      walls(room),
      items,
      [],
      bounds(room),
      4 / 3,
      2.8
    )!;
    expect(result).toBeDefined();
    expect(Number.isFinite(result.first.score)).toBe(true);
    expect(result.first.candidate.pose.position).not.toEqual(
      result.second.candidate.pose.position
    );
  });
  it.each([
    [
      "L",
      [
        [0, 0],
        [7, 0],
        [7, 2],
        [2, 2],
        [2, 6],
        [0, 6]
      ]
    ],
    [
      "T",
      [
        [0, 0],
        [7, 0],
        [7, 2],
        [4.5, 2],
        [4.5, 6],
        [2.5, 6],
        [2.5, 2],
        [0, 2]
      ]
    ],
    [
      "U",
      [
        [0, 0],
        [7, 0],
        [7, 6],
        [5, 6],
        [5, 2],
        [2, 2],
        [2, 6],
        [0, 6]
      ]
    ],
    [
      "free",
      [
        [0, 0],
        [6, 0],
        [7, 3],
        [4, 5],
        [-1, 3]
      ]
    ]
  ] as const)(
    "selects safe views in rotated, furnished %s rooms",
    (_name, coordinates) => {
      const angle = 0.61;
      const rotated = coordinates.map(
        ([x, z]) =>
          [
            x * Math.cos(angle) - z * Math.sin(angle) + 10,
            x * Math.sin(angle) + z * Math.cos(angle) - 4
          ] as const
      );
      const shape = floor(rotated);
      const objects = [
        item(
          "object",
          1 * Math.cos(angle) - Math.sin(angle) + 10,
          Math.sin(angle) + Math.cos(angle) - 4,
          0.6,
          0.8,
          1.1,
          angle
        )
      ];
      const scene = createInteriorVisibilityScene3D(
        shape,
        walls(shape),
        objects
      );
      const result = planRoomInteriors3D(
        shape,
        walls(shape),
        objects,
        [],
        bounds(shape),
        4 / 3,
        2.8
      )!;
      expect(result).toBeDefined();
      expect(
        isSafeInteriorEye3D(result.first.candidate.pose.position, shape, scene)
      ).toBe(true);
      expect(
        isSafeInteriorEye3D(result.second.candidate.pose.position, shape, scene)
      ).toBe(true);
    }
  );
  it("does not invent an eye inside a fully obstructed room", () => {
    const occupied = [item("large", 3.5, 2.5, 7, 5, 2.4)];
    expect(
      planRoomInteriors3D(
        room,
        walls(room),
        occupied,
        [],
        bounds(room),
        4 / 3,
        2.8
      )
    ).toBeUndefined();
  });
  it("keeps valid interior perspectives in a compact empty room", () => {
    const compact = floor([
      [0, 0],
      [1.2, 0],
      [1.2, 1.2],
      [0, 1.2]
    ]);
    const result = planRoomInteriors3D(
      compact,
      walls(compact),
      [],
      [],
      bounds(compact),
      4 / 3,
      2.8
    );
    expect(result).toBeDefined();
    expect(result!.first.candidate.pose.position).not.toEqual(
      result!.second.candidate.pose.position
    );
  });
  it("rejects physical partitions and door leaves without changing canonical geometry", () => {
    const partition = wall("partition", { x: 3, z: 1 }, { x: 3, z: 4 });
    const scene = createInteriorVisibilityScene3D(room, [partition], []);
    expect(isSafeInteriorEye3D({ x: 3, y: 1.7, z: 2 }, room, scene)).toBe(
      false
    );
    const doorWall = createWall3D(
      {
        id: "door-wall",
        start: { x: 1, z: -2 },
        end: { x: 6, z: -2 },
        height: 2.8,
        thickness: 0.16,
        roomIds: ["room"],
        openings: [
          {
            id: "door",
            type: "DOOR",
            offsetFromStart: 1,
            width: 1,
            height: 2.2,
            elevation: 0
          }
        ]
      },
      0,
      "m"
    );
    const doorScene = createInteriorVisibilityScene3D(room, [doorWall], []);
    const leaf = doorWall.doors[0]!.leaf;
    expect(doorScene.solids.some((s) => s.id === "door:door")).toBe(true);
    expect(
      isSafeInteriorEye3D({ ...leaf.center, y: 1.7 }, room, doorScene)
    ).toBe(false);
    const before = structuredClone(partition);
    planRoomInteriors3D(
      room,
      [partition],
      furniture,
      [],
      bounds(room),
      4 / 3,
      2.8
    );
    expect(partition).toEqual(before);
  });
  it("is deterministic, immutable, bounded, and independent of a user viewport camera", () => {
    const target = {
      kind: "room" as const,
      projectId: "synthetic",
      levelId: "level",
      roomId: "room"
    };
    const model = {
      sourceProjectId: "synthetic",
      levels: [
        {
          id: "level",
          name: "Level",
          elevation: 0,
          y: 0,
          segments: [],
          floors: [room],
          walls: walls(room),
          furniture,
          staircases: []
        }
      ]
    };
    const before = structuredClone(model);
    const first = createRoomReferencePlans3D(model, target);
    expect(createRoomReferencePlans3D(model, target)).toEqual(first);
    expect(first).toHaveLength(3);
    expect(model).toEqual(before);
    expect(plan().candidateCount).toBeLessThanOrEqual(
      policy.maximumPositions *
        policy.maximumTargets *
        policy.verticalFovs.length
    );
    expect(Object.keys(first[1]!)).not.toContain("score");
    const reversed = {
      ...model,
      levels: [
        {
          ...model.levels[0]!,
          furniture: [...furniture].reverse(),
          walls: [...model.levels[0]!.walls].reverse()
        }
      ]
    };
    expect(
      createRoomReferencePlans3D(reversed, target)
        .slice(1)
        .map((p) => p.pose)
    ).toEqual(first.slice(1).map((p) => p.pose));
  });
  it("caps detailed analysis for dense layouts while retaining every canonical occluder", () => {
    const large = floor([
      [0, 0],
      [30, 0],
      [30, 20],
      [0, 20]
    ]);
    const objects = Array.from({ length: 70 }, (_, i) =>
      item(
        `object-${i}`,
        1 + (i % 10) * 2.7,
        1 + Math.floor(i / 10) * 2.5,
        0.5,
        0.5
      )
    );
    const scene = createInteriorVisibilityScene3D(large, [], objects);
    expect(scene.furniture).toHaveLength(policy.maximumFurniture);
    expect(scene.solids).toHaveLength(70);
    expect(scene.roomSamples.length).toBeLessThanOrEqual(
      policy.maximumRoomSamples
    );
    expect(scene.architectureSamples.length).toBeLessThanOrEqual(
      policy.maximumArchitectureSamples
    );
    expect(
      generateInteriorCandidates3D(large, scene, bounds(large), 2.8).length
    ).toBeLessThanOrEqual(192);
  });
});

describe("Explainable interior scoring policy", () => {
  const pose = camera(0, 0, 4, 4);
  const baseline: InteriorVisibility3D = {
    furniture: [
      {
        id: "one",
        coverage: 0.4,
        inFrame: 1,
        occluded: 0,
        clipping: 0,
        screenArea: 0.1,
        weight: 1,
        center: { x: 3, y: 0.5, z: 3 }
      }
    ],
    room: [1, 0, 1],
    architecture: [1, 0],
    proximity: 0,
    nearWall: 0
  };
  it("increases the overview score when useful furniture coverage increases", () => {
    const better = {
      ...baseline,
      furniture: baseline.furniture.map((f) => ({ ...f, coverage: 0.8 }))
    };
    expect(
      scoreInteriorOverview3D(interiorScoreTerms3D(better, pose))
    ).toBeGreaterThan(
      scoreInteriorOverview3D(interiorScoreTerms3D(baseline, pose))
    );
  });
  it("penalizes clipping, excessive FOV, nearby walls and occlusion as separate terms", () => {
    const original = interiorScoreTerms3D(baseline, pose);
    for (const term of [
      "clipping",
      "occlusion",
      "domination",
      "distortion",
      "proximity"
    ] as const)
      expect(scoreInteriorOverview3D({ ...original, [term]: 1 })).toBeLessThan(
        scoreInteriorOverview3D(original)
      );
    expect(
      interiorScoreTerms3D(baseline, { ...pose, verticalFovDegrees: 80 })
        .distortion
    ).toBeGreaterThan(original.distortion);
  });
  it("weights physical footprint coverage while keeping an independent instance reward", () => {
    const small = baseline.furniture[0]!;
    const large = {
      ...small,
      id: "large",
      weight: 3,
      coverage: 0,
      center: { x: 6, y: 0.5, z: 4 }
    };
    const first = interiorScoreTerms3D(
      { ...baseline, furniture: [{ ...small, coverage: 1 }, large] },
      pose
    );
    const second = interiorScoreTerms3D(
      {
        ...baseline,
        furniture: [
          { ...small, coverage: 0 },
          { ...large, coverage: 1 }
        ]
      },
      pose
    );
    expect(second.coverage).toBeGreaterThan(first.coverage);
    expect(second.instances).toEqual(first.instances);
  });
  it("rewards B for an item and architecture poorly represented in A over a duplicate", () => {
    const first = {
      ...baseline,
      furniture: [{ ...baseline.furniture[0]!, coverage: 0 }],
      room: [1, 0, 0],
      architecture: [1, 0]
    };
    const complement = {
      ...baseline,
      furniture: [{ ...baseline.furniture[0]!, coverage: 1 }],
      room: [0, 1, 1],
      architecture: [0, 1]
    };
    const candidate = camera(6, 4, 0, 0);
    const better = interiorComplementTerms3D(
      first,
      complement,
      pose,
      candidate
    );
    const duplicate = interiorComplementTerms3D(first, first, pose, pose);
    expect(better.furniture).toBeGreaterThan(duplicate.furniture);
    expect(better.architecture).toBeGreaterThan(duplicate.architecture);
    expect(better.duplicate).toBeLessThan(duplicate.duplicate);
    expect(scoreInteriorComplement3D(better, 0.5)).toBeGreaterThan(
      scoreInteriorComplement3D(duplicate, 0.5)
    );
  });
});
