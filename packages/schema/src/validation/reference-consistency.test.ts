import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import { validateProjectReferenceConsistency } from "./reference-consistency.js";
import { ValidationErrorCode } from "./validation-error-code.js";

const createConsistentProject = (): Project => ({
  id: "casa-simone",
  name: "Casa Simone",
  schemaVersion: "2.0.0",
  revision: 1,
  createdAt: "2026-07-11T15:30:00+02:00",
  updatedAt: "2026-07-11T15:30:00+02:00",
  units: {
    length: "cm",
    angle: "deg"
  },
  building: {
    id: "main-building",
    name: "Main Building",
    type: "HOUSE",
    levels: [
      {
        id: "ground-level",
        name: "Ground Level",
        elevation: 0,
        rooms: [
          {
            id: "living-room",
            name: "Living Room",
            type: "LIVING_ROOM",
            boundary: []
          },
          {
            id: "corridor",
            name: "Corridor",
            type: "CORRIDOR",
            boundary: []
          }
        ],
        walls: [],
        staircases: [
          {
            id: "main-staircase",
            fromLevelId: "ground-level",
            toLevelId: "upper-level",
            fromRoomId: "living-room",
            toRoomId: "bedroom",
            width: 90,
            flights: [],
            landings: []
          }
        ]
      },
      {
        id: "upper-level",
        name: "Upper Level",
        elevation: 300,
        rooms: [
          {
            id: "bedroom",
            name: "Bedroom",
            type: "BEDROOM",
            boundary: []
          },
          {
            id: "bathroom",
            name: "Bathroom",
            type: "BATHROOM",
            boundary: []
          }
        ],
        walls: [],
        staircases: []
      }
    ]
  },
  viewpoints: [
    {
      id: "living-tv-view",
      levelId: "ground-level",
      roomId: "living-room",
      cameraPosition: { x: 250, y: 165, z: 320 },
      cameraTarget: { x: 250, y: 120, z: 120 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    },
    {
      id: "bedroom-view",
      levelId: "upper-level",
      roomId: "bedroom",
      cameraPosition: { x: 100, y: 165, z: 240 },
      cameraTarget: { x: 100, y: 120, z: 40 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    }
  ],
  baseImages: [
    {
      id: "base-image-living-tv-001",
      viewpointId: "living-tv-view",
      assetRef: "assets/base-images/living-tv-001.png",
      projectRevision: 1,
      createdAt: "2026-07-11T16:00:00+02:00"
    },
    {
      id: "base-image-bedroom-001",
      viewpointId: "bedroom-view",
      assetRef: "assets/base-images/bedroom-001.png",
      projectRevision: 1,
      createdAt: "2026-07-11T16:01:00+02:00"
    }
  ],
  designBriefs: [
    {
      id: "warm-industrial-living",
      promptText: "Design a warm industrial living room.",
      constraints: [],
      palette: [],
      referenceAssetRefs: []
    }
  ],
  renderRequests: [
    {
      id: "render-request-001",
      viewpointId: "living-tv-view",
      baseImageId: "base-image-living-tv-001",
      designBriefId: "warm-industrial-living",
      status: "PENDING",
      createdAt: "2026-07-11T16:05:00+02:00"
    }
  ],
  renderResults: []
});

const getFirst = <Item>(items: Item[], label: string): Item => {
  const item = items.at(0);

  if (!item) {
    throw new Error(`Test fixture is missing ${label}.`);
  }

  return item;
};

const addReciprocalExteriorWalls = (project: Project) => {
  const level = getFirst(project.building.levels, "level");
  const room = getFirst(level.rooms, "room");

  room.boundary = [
    { wallId: "living-wall-north", direction: "FORWARD" },
    { wallId: "living-wall-east", direction: "FORWARD" },
    { wallId: "living-wall-south", direction: "FORWARD" }
  ];
  level.walls = [
    {
      id: "living-wall-north",
      start: { x: 0, z: 0 },
      end: { x: 400, z: 0 },
      height: 280,
      thickness: 15,
      roomIds: ["living-room"],
      openings: []
    },
    {
      id: "living-wall-east",
      start: { x: 400, z: 0 },
      end: { x: 400, z: 300 },
      height: 280,
      thickness: 15,
      roomIds: ["living-room"],
      openings: []
    },
    {
      id: "living-wall-south",
      start: { x: 400, z: 300 },
      end: { x: 0, z: 300 },
      height: 280,
      thickness: 15,
      roomIds: ["living-room"],
      openings: []
    }
  ];

  return { level, room };
};

describe("validateProjectReferenceConsistency", () => {
  it("returns valid true for a completely consistent Project", () => {
    const result = validateProjectReferenceConsistency(createConsistentProject());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts reciprocal room-wall boundary relationships", () => {
    const project = createConsistentProject();

    addReciprocalExteriorWalls(project);

    expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
  });

  it("reports when a room boundary references a wall that omits the room", () => {
    const project = createConsistentProject();
    const { level } = addReciprocalExteriorWalls(project);
    const wall = getFirst(level.walls, "wall");

    wall.roomIds = [];

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.ROOM_WALL_REFERENCE_MISMATCH,
        path: "building.levels[0].rooms[0].boundary[0].wallId"
      }
    ]);
    expect(result.errors[0]?.message).toContain("living-room");
    expect(result.errors[0]?.message).toContain("living-wall-north");
  });

  it("reports when a wall references a room that omits the wall", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");
    const room = getFirst(level.rooms, "room");

    room.boundary = [];
    level.walls = [
      {
        id: "living-wall-north",
        start: { x: 0, z: 0 },
        end: { x: 400, z: 0 },
        height: 280,
        thickness: 15,
        roomIds: ["living-room"],
        openings: []
      }
    ];

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.ROOM_WALL_REFERENCE_MISMATCH,
        path: "building.levels[0].walls[0].roomIds[0]"
      }
    ]);
  });

  it("allows draft rooms when no wall declares the draft room", () => {
    const project = createConsistentProject();

    expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
  });

  it("rejects draft rooms listed by a wall", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");

    level.walls = [
      {
        id: "draft-wall",
        start: { x: 0, z: 0 },
        end: { x: 100, z: 0 },
        height: 280,
        thickness: 15,
        roomIds: ["living-room"],
        openings: []
      }
    ];

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.ROOM_WALL_REFERENCE_MISMATCH,
        path: "building.levels[0].walls[0].roomIds[0]"
      }
    ]);
  });

  it("allows exterior walls with one reciprocal room", () => {
    const project = createConsistentProject();

    addReciprocalExteriorWalls(project);

    expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
  });

  it("allows unassigned walls with zero room IDs", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");

    level.walls = [
      {
        id: "unassigned-wall",
        start: { x: 0, z: 0 },
        end: { x: 100, z: 0 },
        height: 280,
        thickness: 15,
        roomIds: [],
        openings: []
      }
    ];

    expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
  });

  it("rejects room boundaries that reference walls with zero rooms", () => {
    const project = createConsistentProject();
    const { level } = addReciprocalExteriorWalls(project);

    getFirst(level.walls, "wall").roomIds = [];

    const result = validateProjectReferenceConsistency(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.ROOM_WALL_REFERENCE_MISMATCH,
        path: "building.levels[0].rooms[0].boundary[0].wallId"
      }
    ]);
  });

  it("allows shared walls with two reciprocal rooms", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");
    const livingRoom = getFirst(level.rooms, "room");
    const corridor = level.rooms[1];

    if (!corridor) {
      throw new Error("Test fixture is missing corridor.");
    }

    livingRoom.boundary = [
      { wallId: "shared-wall", direction: "FORWARD" },
      { wallId: "living-wall-east", direction: "FORWARD" },
      { wallId: "living-wall-south", direction: "FORWARD" }
    ];
    corridor.boundary = [
      { wallId: "shared-wall", direction: "FORWARD" },
      { wallId: "corridor-wall-east", direction: "FORWARD" },
      { wallId: "corridor-wall-south", direction: "FORWARD" }
    ];
    level.walls = [
      {
        id: "shared-wall",
        start: { x: 0, z: 0 },
        end: { x: 300, z: 0 },
        height: 280,
        thickness: 15,
        roomIds: ["living-room", "corridor"],
        openings: []
      },
      {
        id: "living-wall-east",
        start: { x: 300, z: 0 },
        end: { x: 300, z: 300 },
        height: 280,
        thickness: 15,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "living-wall-south",
        start: { x: 300, z: 300 },
        end: { x: 0, z: 300 },
        height: 280,
        thickness: 15,
        roomIds: ["living-room"],
        openings: []
      },
      {
        id: "corridor-wall-east",
        start: { x: 300, z: 0 },
        end: { x: 300, z: -300 },
        height: 280,
        thickness: 15,
        roomIds: ["corridor"],
        openings: []
      },
      {
        id: "corridor-wall-south",
        start: { x: 300, z: -300 },
        end: { x: 0, z: -300 },
        height: 280,
        thickness: 15,
        roomIds: ["corridor"],
        openings: []
      }
    ];

    expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
  });

  it("defensively reports duplicate room IDs on a wall", () => {
    const project = createConsistentProject();
    const { level } = addReciprocalExteriorWalls(project);

    getFirst(level.walls, "wall").roomIds = ["living-room", "living-room"];

    const result = validateProjectReferenceConsistency(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.DUPLICATE_WALL_ROOM_REFERENCE,
        path: "building.levels[0].walls[0].roomIds"
      }
    ]);
  });

  it("defensively reports walls that reference more than two rooms", () => {
    const project = createConsistentProject();
    const { level } = addReciprocalExteriorWalls(project);
    const thirdRoom = {
      id: "library",
      name: "Library",
      type: "STUDIO" as const,
      boundary: [{ wallId: "living-wall-north", direction: "FORWARD" as const }]
    };

    level.rooms.push(thirdRoom);
    getFirst(level.walls, "wall").roomIds = ["living-room", "corridor", "library"];

    const result = validateProjectReferenceConsistency(project);

    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.NON_MANIFOLD_WALL_REFERENCE,
        path: "building.levels[0].walls[0].roomIds"
      }
    ]);
  });

  it("does not report consistency mismatch for missing boundary walls", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");
    const room = getFirst(level.rooms, "room");

    room.boundary = [{ wallId: "missing-wall", direction: "FORWARD" }];

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("does not report consistency mismatch for missing wall rooms", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");

    level.walls = [
      {
        id: "orphan-wall",
        start: { x: 0, z: 0 },
        end: { x: 100, z: 0 },
        height: 280,
        thickness: 15,
        roomIds: ["missing-room"],
        openings: []
      }
    ];

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports when a Viewpoint Room belongs to another Level", () => {
    const project = createConsistentProject();
    const viewpoint = getFirst(project.viewpoints, "viewpoint");

    viewpoint.roomId = "bedroom";

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.VIEWPOINT_ROOM_LEVEL_MISMATCH,
        path: "viewpoints[0].roomId"
      }
    ]);
    expect(result.errors[0]?.message).toContain(viewpoint.id);
    expect(result.errors[0]?.message).toContain("bedroom");
    expect(result.errors[0]?.message).toContain("upper-level");
    expect(result.errors[0]?.message).toContain("ground-level");
  });

  it("reports when a Staircase fromRoom belongs to another Level", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");
    const staircase = getFirst(level.staircases, "staircase");

    staircase.fromRoomId = "bedroom";

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.STAIRCASE_FROM_ROOM_LEVEL_MISMATCH,
        path: "building.levels[0].staircases[0].fromRoomId"
      }
    ]);
    expect(result.errors[0]?.message).toContain(staircase.id);
    expect(result.errors[0]?.message).toContain("bedroom");
    expect(result.errors[0]?.message).toContain("upper-level");
    expect(result.errors[0]?.message).toContain("ground-level");
  });

  it("reports when a Staircase toRoom belongs to another Level", () => {
    const project = createConsistentProject();
    const level = getFirst(project.building.levels, "level");
    const staircase = getFirst(level.staircases, "staircase");

    staircase.toRoomId = "living-room";

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.STAIRCASE_TO_ROOM_LEVEL_MISMATCH,
        path: "building.levels[0].staircases[0].toRoomId"
      }
    ]);
    expect(result.errors[0]?.message).toContain(staircase.id);
    expect(result.errors[0]?.message).toContain("living-room");
    expect(result.errors[0]?.message).toContain("ground-level");
    expect(result.errors[0]?.message).toContain("upper-level");
  });

  it("reports when a RenderRequest BaseImage belongs to another Viewpoint", () => {
    const project = createConsistentProject();
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    renderRequest.baseImageId = "base-image-bedroom-001";

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.RENDER_REQUEST_VIEWPOINT_BASE_IMAGE_MISMATCH,
        path: "renderRequests[0].baseImageId"
      }
    ]);
    expect(result.errors[0]?.message).toContain(renderRequest.id);
    expect(result.errors[0]?.message).toContain("base-image-bedroom-001");
    expect(result.errors[0]?.message).toContain("bedroom-view");
    expect(result.errors[0]?.message).toContain("living-tv-view");
  });

  it("collects multiple consistency errors", () => {
    const project = createConsistentProject();
    const viewpoint = getFirst(project.viewpoints, "viewpoint");
    const level = getFirst(project.building.levels, "level");
    const staircase = getFirst(level.staircases, "staircase");
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    viewpoint.roomId = "bedroom";
    staircase.fromRoomId = "bedroom";
    staircase.toRoomId = "living-room";
    renderRequest.baseImageId = "base-image-bedroom-001";

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
    expect(result.errors.map((error) => error.code)).toEqual([
      ValidationErrorCode.VIEWPOINT_ROOM_LEVEL_MISMATCH,
      ValidationErrorCode.STAIRCASE_FROM_ROOM_LEVEL_MISMATCH,
      ValidationErrorCode.STAIRCASE_TO_ROOM_LEVEL_MISMATCH,
      ValidationErrorCode.RENDER_REQUEST_VIEWPOINT_BASE_IMAGE_MISMATCH
    ]);
    expect(result.errors.map((error) => error.path)).toEqual([
      "viewpoints[0].roomId",
      "building.levels[0].staircases[0].fromRoomId",
      "building.levels[0].staircases[0].toRoomId",
      "renderRequests[0].baseImageId"
    ]);
  });

  it("skips consistency checks when referenced entities are missing", () => {
    const project = createConsistentProject();
    const viewpoint = getFirst(project.viewpoints, "viewpoint");
    const level = getFirst(project.building.levels, "level");
    const staircase = getFirst(level.staircases, "staircase");
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    viewpoint.levelId = "missing-viewpoint-level";
    viewpoint.roomId = "missing-viewpoint-room";
    staircase.fromLevelId = "missing-from-level";
    staircase.fromRoomId = "missing-from-room";
    staircase.toLevelId = "missing-to-level";
    staircase.toRoomId = "missing-to-room";
    renderRequest.viewpointId = "missing-render-request-viewpoint";
    renderRequest.baseImageId = "missing-base-image";

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("skips optional room references when omitted", () => {
    const project = createConsistentProject();
    const viewpoint = getFirst(project.viewpoints, "viewpoint");
    const level = getFirst(project.building.levels, "level");
    const staircase = getFirst(level.staircases, "staircase");

    delete viewpoint.roomId;
    delete staircase.fromRoomId;
    delete staircase.toRoomId;

    const result = validateProjectReferenceConsistency(project);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
