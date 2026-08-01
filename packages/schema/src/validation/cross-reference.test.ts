import { describe, expect, it } from "vitest";

import type { Project } from "../project";
import { validateProjectCrossReferences } from "./cross-reference";
import { ValidationErrorCode } from "./validation-error-code";

const createValidProject = (): Project => ({
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
            boundary: [
              {
                wallId: "living-wall-tv",
                direction: "FORWARD"
              },
              {
                wallId: "living-wall-west",
                direction: "FORWARD"
              },
              {
                wallId: "living-wall-south",
                direction: "FORWARD"
              }
            ]
          },
          {
            id: "corridor",
            name: "Corridor",
            type: "CORRIDOR",
            boundary: [
              {
                wallId: "living-wall-tv",
                direction: "REVERSE"
              },
              {
                wallId: "corridor-wall-south",
                direction: "FORWARD"
              },
              {
                wallId: "corridor-wall-west",
                direction: "FORWARD"
              }
            ]
          }
        ],
        walls: [
          {
            id: "living-wall-tv",
            start: { x: 0, z: 0 },
            end: { x: 488, z: 0 },
            height: 390,
            thickness: 15,
            roomIds: ["living-room", "corridor"],
            openings: [
              {
                id: "living-door",
                type: "DOOR",
                offsetFromStart: 42,
                width: 80,
                height: 210,
                elevation: 0,
                connectedRoomIds: ["living-room", "corridor"]
              },
              {
                id: "main-window",
                type: "WINDOW",
                offsetFromStart: 220,
                width: 120,
                height: 165,
                elevation: 90
              }
            ]
          },
          {
            id: "living-wall-west",
            start: { x: 0, z: 0 },
            end: { x: 0, z: 400 },
            height: 390,
            thickness: 15,
            roomIds: ["living-room"],
            openings: []
          },
          {
            id: "living-wall-south",
            start: { x: 0, z: 400 },
            end: { x: 488, z: 400 },
            height: 390,
            thickness: 15,
            roomIds: ["living-room"],
            openings: []
          },
          {
            id: "corridor-wall-south",
            start: { x: 0, z: 400 },
            end: { x: 488, z: 400 },
            height: 390,
            thickness: 15,
            roomIds: ["corridor"],
            openings: []
          },
          {
            id: "corridor-wall-west",
            start: { x: 0, z: 0 },
            end: { x: 0, z: 400 },
            height: 390,
            thickness: 15,
            roomIds: ["corridor"],
            openings: []
          }
        ],
        staircases: [
          {
            id: "living-mezzanine-staircase",
            fromLevelId: "ground-level",
            toLevelId: "ground-level",
            fromRoomId: "living-room",
            toRoomId: "corridor",
            width: 62,
            flights: [],
            landings: []
          }
        ]
      },
      {
        id: "upper-level",
        name: "Upper Level",
        elevation: 320,
        rooms: [],
        walls: [
          {
            id: "upper-only-wall",
            start: { x: 0, z: 0 },
            end: { x: 300, z: 0 },
            height: 300,
            thickness: 15,
            roomIds: [],
            openings: []
          }
        ],
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
    }
  ],
  baseImages: [
    {
      id: "base-image-living-tv-001",
      viewpointId: "living-tv-view",
      assetRef: "assets/base-images/living-tv-001.png",
      projectRevision: 1,
      createdAt: "2026-07-11T16:00:00+02:00"
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
  renderResults: [
    {
      id: "render-result-001",
      renderRequestId: "render-request-001",
      status: "SUCCEEDED",
      createdAt: "2026-07-11T16:05:45+02:00",
      assetRef: "assets/renders/render-result-001.png"
    }
  ]
});

const getFirst = <Item>(items: Item[], label: string): Item => {
  const item = items.at(0);

  if (!item) {
    throw new Error(`Test fixture is missing ${label}.`);
  }

  return item;
};

describe("validateProjectCrossReferences", () => {
  it("returns valid true for a valid Project", () => {
    const result = validateProjectCrossReferences(createValidProject());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports a missing Wall referenced by Room.boundary", () => {
    const project = createValidProject();
    const level = getFirst(project.building.levels, "level");
    const room = getFirst(level.rooms, "room");

    getFirst(room.boundary, "boundary edge").wallId = "missing-wall";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.MISSING_ROOM_BOUNDARY_WALL,
        path: "building.levels[0].rooms[0].boundary[0].wallId"
      }
    ]);
  });

  it("reports room boundaries that reference walls from another level", () => {
    const project = createValidProject();
    const level = getFirst(project.building.levels, "level");
    const room = getFirst(level.rooms, "room");

    getFirst(room.boundary, "boundary edge").wallId = "upper-only-wall";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.CROSS_LEVEL_ROOM_BOUNDARY,
        path: "building.levels[0].rooms[0].boundary[0].wallId"
      }
    ]);
  });

  it("allows draft rooms with empty boundaries", () => {
    const project = createValidProject();
    const level = getFirst(project.building.levels, "level");
    const room = getFirst(level.rooms, "room");

    room.boundary = [];

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports missing Rooms referenced by Wall.roomIds and Opening.connectedRoomIds", () => {
    const project = createValidProject();
    const level = getFirst(project.building.levels, "level");
    const wall = getFirst(level.walls, "wall");
    const opening = getFirst(wall.openings, "opening");

    wall.roomIds[1] = "missing-wall-room";

    if (opening.type !== "DOOR") {
      throw new Error("Test fixture first opening must be a door.");
    }

    opening.connectedRoomIds = ["living-room", "missing-connected-room"];

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.ROOM_NOT_FOUND,
        path: "building.levels[0].walls[0].roomIds[1]"
      },
      {
        code: ValidationErrorCode.ROOM_NOT_FOUND,
        path: "building.levels[0].walls[0].openings[0].connectedRoomIds[1]"
      }
    ]);
  });

  it("reports missing Levels referenced by Staircase and Viewpoint", () => {
    const project = createValidProject();
    const level = getFirst(project.building.levels, "level");
    const staircase = getFirst(level.staircases, "staircase");
    const viewpoint = getFirst(project.viewpoints, "viewpoint");

    staircase.fromLevelId = "missing-from-level";
    staircase.toLevelId = "missing-to-level";
    viewpoint.levelId = "missing-viewpoint-level";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.LEVEL_NOT_FOUND,
        path: "building.levels[0].staircases[0].fromLevelId"
      },
      {
        code: ValidationErrorCode.LEVEL_NOT_FOUND,
        path: "building.levels[0].staircases[0].toLevelId"
      },
      {
        code: ValidationErrorCode.LEVEL_NOT_FOUND,
        path: "viewpoints[0].levelId"
      }
    ]);
  });

  it("reports missing Rooms referenced by Staircase and Viewpoint", () => {
    const project = createValidProject();
    const level = getFirst(project.building.levels, "level");
    const staircase = getFirst(level.staircases, "staircase");
    const viewpoint = getFirst(project.viewpoints, "viewpoint");

    staircase.fromRoomId = "missing-from-room";
    staircase.toRoomId = "missing-to-room";
    viewpoint.roomId = "missing-viewpoint-room";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.ROOM_NOT_FOUND,
        path: "building.levels[0].staircases[0].fromRoomId"
      },
      {
        code: ValidationErrorCode.ROOM_NOT_FOUND,
        path: "building.levels[0].staircases[0].toRoomId"
      },
      {
        code: ValidationErrorCode.ROOM_NOT_FOUND,
        path: "viewpoints[0].roomId"
      }
    ]);
  });

  it("reports a missing Viewpoint referenced by BaseImage", () => {
    const project = createValidProject();
    const baseImage = getFirst(project.baseImages, "baseImage");

    baseImage.viewpointId = "missing-viewpoint";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.VIEWPOINT_NOT_FOUND,
        path: "baseImages[0].viewpointId"
      }
    ]);
  });

  it("reports missing Viewpoint, BaseImage, and DesignBrief references on RenderRequest", () => {
    const project = createValidProject();
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    renderRequest.viewpointId = "missing-render-viewpoint";
    renderRequest.baseImageId = "missing-base-image";
    renderRequest.designBriefId = "missing-design-brief";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.VIEWPOINT_NOT_FOUND,
        path: "renderRequests[0].viewpointId"
      },
      {
        code: ValidationErrorCode.BASE_IMAGE_NOT_FOUND,
        path: "renderRequests[0].baseImageId"
      },
      {
        code: ValidationErrorCode.DESIGN_BRIEF_NOT_FOUND,
        path: "renderRequests[0].designBriefId"
      }
    ]);
  });

  it("reports a missing RenderRequest referenced by RenderResult", () => {
    const project = createValidProject();
    const renderResult = getFirst(project.renderResults, "renderResult");

    renderResult.renderRequestId = "missing-render-request";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.RENDER_REQUEST_NOT_FOUND,
        path: "renderResults[0].renderRequestId"
      }
    ]);
  });

  it("collects multiple simultaneous errors", () => {
    const project = createValidProject();
    const level = getFirst(project.building.levels, "level");
    const room = getFirst(level.rooms, "room");
    const viewpoint = getFirst(project.viewpoints, "viewpoint");
    const baseImage = getFirst(project.baseImages, "baseImage");
    const renderRequest = getFirst(project.renderRequests, "renderRequest");
    const renderResult = getFirst(project.renderResults, "renderResult");

    getFirst(room.boundary, "boundary edge").wallId = "missing-wall";
    viewpoint.levelId = "missing-level";
    baseImage.viewpointId = "missing-viewpoint";
    renderRequest.baseImageId = "missing-base-image";
    renderRequest.designBriefId = "missing-design-brief";
    renderResult.renderRequestId = "missing-render-request";

    const result = validateProjectCrossReferences(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(6);
    expect(result.errors[0]?.message).toContain('missing-wall');
    expect(result.errors.map((error) => error.code)).toEqual([
      ValidationErrorCode.MISSING_ROOM_BOUNDARY_WALL,
      ValidationErrorCode.LEVEL_NOT_FOUND,
      ValidationErrorCode.VIEWPOINT_NOT_FOUND,
      ValidationErrorCode.BASE_IMAGE_NOT_FOUND,
      ValidationErrorCode.DESIGN_BRIEF_NOT_FOUND,
      ValidationErrorCode.RENDER_REQUEST_NOT_FOUND
    ]);
    expect(result.errors.map((error) => error.path)).toEqual([
      "building.levels[0].rooms[0].boundary[0].wallId",
      "viewpoints[0].levelId",
      "baseImages[0].viewpointId",
      "renderRequests[0].baseImageId",
      "renderRequests[0].designBriefId",
      "renderResults[0].renderRequestId"
    ]);
  });
});
