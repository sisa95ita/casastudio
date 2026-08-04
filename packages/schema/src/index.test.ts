import { describe, expect, it } from "vitest";

import {
  BaseImageSchema,
  BuildingSchema,
  CURRENT_PROJECT_SCHEMA_VERSION,
  DesignBriefSchema,
  IdentifierSchema,
  LegacyRoomBoundaryMigrationFailureReason,
  migrateProject,
  MigrationErrorCode,
  OpeningSchema,
  Point2DSchema,
  ProjectSchema,
  ProjectSchemaVersionSchema,
  RenderRequestSchema,
  RenderResultSchema,
  reverseWallDirection,
  RoomBoundaryDirectionSchema,
  RoomBoundaryEdgeSchema,
  RoomSchema,
  StairFlightSchema,
  StairLandingSchema,
  StaircaseSchema,
  SUPPORTED_PROJECT_SCHEMA_VERSIONS,
  UnitsSchema,
  ValidationErrorCode,
  ViewpointSchema,
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  validateProjectRenderability,
  type BaseImage,
  type DesignBrief,
  type Project,
  type ProjectMigrationError,
  type ProjectMigrationResult,
  type RenderRequest,
  type RenderResult,
  type ReverseWallDirectionResult,
  type RoomBoundaryDirection,
  type RoomBoundaryEdge,
  type StairFlight,
  type StairLanding,
  type Staircase,
  type SupportedProjectSchemaVersion,
  type Viewpoint
} from "./index.js";

describe("package barrel exports", () => {
  it("exports shared schemas from the package entry point", () => {
    expect(IdentifierSchema.parse("casa-simone")).toBe("casa-simone");
    expect(Point2DSchema.parse({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });
    expect(UnitsSchema.parse({ length: "cm", angle: "deg" })).toEqual({ length: "cm", angle: "deg" });
    expect(BuildingSchema.parse({ id: "main-building", name: "Main Building", type: "HOUSE", levels: [] }).id).toBe(
      "main-building"
    );
    expect(RoomSchema.parse({ id: "living-room", name: "Living Room", type: "LIVING_ROOM", boundary: [] }).id).toBe(
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

  it("exports design rendering schemas and inferred types from the package entry point", () => {
    const designBrief: DesignBrief = {
      id: "warm-industrial-living",
      promptText: "Design a warm industrial living room.",
      constraints: [],
      palette: [],
      referenceAssetRefs: []
    };
    const renderRequest: RenderRequest = {
      id: "render-request-001",
      viewpointId: "living-tv-view",
      baseImageId: "base-image-living-tv-001",
      designBriefId: "warm-industrial-living",
      status: "PENDING",
      createdAt: "2026-07-11T16:05:00+02:00"
    };
    const renderResult: RenderResult = {
      id: "render-result-001",
      renderRequestId: "render-request-001",
      status: "SUCCEEDED",
      createdAt: "2026-07-11T16:05:45+02:00",
      assetRef: "assets/renders/render-result-001.png"
    };

    expect(DesignBriefSchema.parse(designBrief)).toEqual(designBrief);
    expect(RenderRequestSchema.parse(renderRequest)).toEqual(renderRequest);
    expect(RenderResultSchema.parse(renderResult)).toEqual(renderResult);
  });

  it("exports ProjectSchema and inferred Project type from the package entry point", () => {
    const project: Project = {
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
        levels: []
      },
      viewpoints: [],
      baseImages: [],
      designBriefs: [],
      renderRequests: [],
      renderResults: []
    };

    expect(ProjectSchema.parse(project)).toEqual(project);
  });

  it("exports schema version and room boundary contracts from the package entry point", () => {
    const schemaVersion: SupportedProjectSchemaVersion = "2.0.0";
    const direction: RoomBoundaryDirection = "FORWARD";
    const edge: RoomBoundaryEdge = {
      wallId: "living-wall-tv",
      direction
    };

    expect(CURRENT_PROJECT_SCHEMA_VERSION).toBe(schemaVersion);
    expect(SUPPORTED_PROJECT_SCHEMA_VERSIONS).toEqual(["2.0.0"]);
    expect(ProjectSchemaVersionSchema.parse("2.0.0")).toBe("2.0.0");
    expect(RoomBoundaryDirectionSchema.parse(direction)).toBe(direction);
    expect(RoomBoundaryEdgeSchema.parse(edge)).toEqual(edge);
  });

  it("exports migration contracts from the package entry point", () => {
    const error: ProjectMigrationError = {
      code: MigrationErrorCode.UNSUPPORTED_PROJECT_SCHEMA_VERSION,
      message: "Unsupported.",
      reason: LegacyRoomBoundaryMigrationFailureReason.INVALID_LEGACY_SHAPE
    };
    const result: ProjectMigrationResult = {
      ok: false,
      errors: [error]
    };

    expect(MigrationErrorCode.MISSING_SCHEMA_VERSION).toBe("MISSING_SCHEMA_VERSION");
    expect(LegacyRoomBoundaryMigrationFailureReason.OPEN_LOOP).toBe("OPEN_LOOP");
    expect(result.errors).toEqual([error]);
    expect(migrateProject({ schemaVersion: "9.9.9" })).toMatchObject({
      ok: false,
      errors: [{ code: MigrationErrorCode.UNSUPPORTED_PROJECT_SCHEMA_VERSION }]
    });
  });

  it("exports validation contracts and validators from the package entry point", () => {
    const project: Project = {
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
        levels: []
      },
      viewpoints: [],
      baseImages: [],
      designBriefs: [],
      renderRequests: [],
      renderResults: []
    };

    expect(ValidationErrorCode.ROOM_NOT_FOUND).toBe("ROOM_NOT_FOUND");
    expect(ValidationErrorCode.DUPLICATE_WALL_ID).toBe("DUPLICATE_WALL_ID");
    expect(ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED).toBe("PROJECT_SCHEMA_VALIDATION_FAILED");
    expect(ValidationErrorCode.WALL_ZERO_LENGTH).toBe("WALL_ZERO_LENGTH");
    expect(validateProjectCrossReferences(project)).toEqual({ valid: true, errors: [] });
    expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
    expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
    expect(validateProjectRenderability(project)).toMatchObject({
      valid: false,
      errors: [
        {
          code: ValidationErrorCode.PROJECT_HAS_NO_VIEWPOINTS,
          path: "viewpoints"
        },
        {
          code: ValidationErrorCode.PROJECT_HAS_NO_DESIGN_BRIEFS,
          path: "designBriefs"
        },
        {
          code: ValidationErrorCode.PROJECT_HAS_NO_RENDER_REQUESTS,
          path: "renderRequests"
        }
      ]
    });
  });

  it("exports physical-building domain operations from the package entry point", () => {
    const project: Project = {
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
        levels: []
      },
      viewpoints: [],
      baseImages: [],
      designBriefs: [],
      renderRequests: [],
      renderResults: []
    };
    const result: ReverseWallDirectionResult = reverseWallDirection(project, "missing-wall");

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_NOT_FOUND }]
    });
  });
});
