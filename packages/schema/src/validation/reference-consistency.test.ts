import { describe, expect, it } from "vitest";

import type { Project } from "../project";
import { validateProjectReferenceConsistency } from "./reference-consistency";
import { ValidationErrorCode } from "./validation-error-code";

const createConsistentProject = (): Project => ({
  id: "casa-simone",
  name: "Casa Simone",
  schemaVersion: "1.0.0",
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
            wallIds: []
          },
          {
            id: "corridor",
            name: "Corridor",
            type: "CORRIDOR",
            wallIds: []
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
            wallIds: []
          },
          {
            id: "bathroom",
            name: "Bathroom",
            type: "BATHROOM",
            wallIds: []
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

describe("validateProjectReferenceConsistency", () => {
  it("returns valid true for a completely consistent Project", () => {
    const result = validateProjectReferenceConsistency(createConsistentProject());

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
