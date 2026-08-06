import { GeometryBuildErrorCode, GeometryEngine, type GeometryBuildResult } from "@casastudio/geometry";
import { ProjectSchema, type Project } from "@casastudio/schema";
import { describe, expect, it, vi } from "vitest";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { AuthorizedProjectLoader } from "../application/authorized-project-loader.service";
import { ProjectReadAuthorizationPolicy } from "../application/project-read-authorization.policy";
import { PersistedProjectInvalidError, ProjectPersistenceError } from "../persistence/project-persistence-error";
import type { LoadedProject, ProjectsRepository } from "../persistence/project.repository";
import { GeometrySnapshotApiMapper, GeometrySnapshotSerializationInvariantError } from "./geometry-snapshot-api.mapper";
import { GetProjectGeometryService } from "./get-project-geometry.service";
import type { ProjectGeometryBuilder } from "./project-geometry-builder";

const ownerSubject = "owner-subject";

describe("GetProjectGeometryService", () => {
  it("returns a geometry response for the owner and preserves source invariants", async () => {
    const project = buildRectangularRoomProject();
    const builder = createBuilder(GeometryEngine.build(project));
    const service = createService({
      loadedProject: createLoadedProject(project),
      builder
    });

    const response = await service.getProjectGeometry(project.id, {
      subject: ownerSubject,
      roles: ["casastudio-user"]
    });

    expect(response.sourceProjectId).toBe(project.id);
    expect(response.sourceRevision).toBe(project.revision);
    expect(response.geometry.levels[0]?.polygons[0]?.sourceRoomId).toBe("living-room");
    expect(builder.build).toHaveBeenCalledTimes(1);
    expect(builder.build).toHaveBeenCalledWith(project);
  });

  it("allows administrators to read non-owned Project geometry", async () => {
    const project = buildRectangularRoomProject();
    const service = createService({
      loadedProject: createLoadedProject(project)
    });

    await expect(
      service.getProjectGeometry(project.id, {
        subject: "admin-subject",
        roles: ["casastudio-admin"]
      })
    ).resolves.toMatchObject({
      sourceProjectId: project.id,
      sourceRevision: project.revision
    });
  });

  it("reuses Project not-found, forbidden, persisted-state, and read-failed behavior", async () => {
    const project = buildRectangularRoomProject();

    await expect(
      createService({ loadedProject: null }).getProjectGeometry(project.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectNotFound,
      status: 404
    });

    await expect(
      createService({ loadedProject: createLoadedProject(project) }).getProjectGeometry(project.id, {
        subject: "other-subject",
        username: ownerSubject,
        email: "owner@example.test",
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectAccessForbidden,
      status: 403
    });

    await expect(
      createService({ error: new PersistedProjectInvalidError("bad rows", []) }).getProjectGeometry(project.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectPersistedStateInvalid,
      status: 500
    });

    await expect(
      createService({ error: new ProjectPersistenceError("database unavailable") }).getProjectGeometry(project.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectReadFailed,
      status: 500
    });
  });

  it("maps Geometry Engine validation diagnostics to PROJECT_GEOMETRY_INVALID", async () => {
    const project = buildRectangularRoomProject();
    const diagnostics = [
      {
        code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
        message: "bad geometry",
        path: "building.levels[0].rooms[0].boundary",
        sourceId: "living-room"
      }
    ];
    const service = createService({
      loadedProject: createLoadedProject(project),
      builder: createBuilder({
        ok: false,
        errors: diagnostics
      })
    });

    await expect(
      service.getProjectGeometry(project.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectGeometryInvalid,
      status: 500,
      cause: diagnostics
    });
  });

  it("maps unexpected Geometry Engine exceptions to PROJECT_GEOMETRY_BUILD_FAILED", async () => {
    const project = buildRectangularRoomProject();
    const cause = new Error("engine internals");
    const service = createService({
      loadedProject: createLoadedProject(project),
      builder: {
        build: vi.fn<ProjectGeometryBuilder["build"]>(() => {
          throw cause;
        })
      }
    });

    await expect(
      service.getProjectGeometry(project.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectGeometryBuildFailed,
      status: 500,
      cause
    });
  });

  it("maps snapshot invariant failures to PROJECT_GEOMETRY_SERIALIZATION_FAILED", async () => {
    const project = buildRectangularRoomProject();
    const model = expectModel(GeometryEngine.build(project));
    const cause = new GeometrySnapshotSerializationInvariantError("non-finite");
    const mapper = {
      toProjectGeometryResponse: vi.fn<GeometrySnapshotApiMapper["toProjectGeometryResponse"]>(() => {
        throw cause;
      })
    } as GeometrySnapshotApiMapper;
    const service = createService({
      loadedProject: createLoadedProject(project),
      builder: createBuilder({
        ok: true,
        model
      }),
      mapper
    });

    await expect(
      service.getProjectGeometry(project.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectGeometrySerializationFailed,
      status: 500,
      cause
    });
  });
});

function createService(input: {
  readonly loadedProject?: LoadedProject | null;
  readonly error?: Error;
  readonly builder?: ProjectGeometryBuilder;
  readonly mapper?: GeometrySnapshotApiMapper;
}): GetProjectGeometryService {
  const repository = createRepository({
    loadedProject: input.loadedProject,
    error: input.error
  });
  const loader = new AuthorizedProjectLoader(repository, new ProjectReadAuthorizationPolicy());

  return new GetProjectGeometryService(
    loader,
    input.builder ?? createBuilder(GeometryEngine.build(buildRectangularRoomProject())),
    input.mapper ?? new GeometrySnapshotApiMapper()
  );
}

function createBuilder(result: GeometryBuildResult): ProjectGeometryBuilder {
  return {
    build: vi.fn<ProjectGeometryBuilder["build"]>(() => result)
  };
}

function createRepository(input: { readonly loadedProject?: LoadedProject | null; readonly error?: Error }): ProjectsRepository {
  return {
    findByDomainId: vi.fn<ProjectsRepository["findByDomainId"]>(),
    findLoadedByDomainId: vi.fn<ProjectsRepository["findLoadedByDomainId"]>(async () => {
      if (input.error) {
        throw input.error;
      }

      return input.loadedProject ?? null;
    })
  };
}

function createLoadedProject(project: Project): LoadedProject {
  const metadataDate = new Date("2026-08-04T10:00:00.000Z");

  return {
    project,
    metadata: {
      ownerSubject,
      createdBySubject: ownerSubject,
      updatedBySubject: ownerSubject,
      createdAt: metadataDate,
      updatedAt: metadataDate
    }
  };
}

function expectModel(result: GeometryBuildResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected geometry build to succeed.");
  }

  return result.model;
}

function buildRectangularRoomProject(): Project {
  return ProjectSchema.parse({
    id: "geometry-slice-project",
    name: "Geometry Slice Project",
    schemaVersion: "2.0.0",
    revision: 7,
    createdAt: "2026-07-20T10:00:00+02:00",
    updatedAt: "2026-07-20T10:00:00+02:00",
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
                { wallId: "north-wall", direction: "FORWARD" },
                { wallId: "east-wall", direction: "FORWARD" },
                { wallId: "south-wall", direction: "REVERSE" },
                { wallId: "west-wall", direction: "FORWARD" }
              ]
            }
          ],
          walls: [
            {
              id: "north-wall",
              start: { x: 0, z: 0 },
              end: { x: 400, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            },
            {
              id: "east-wall",
              start: { x: 400, z: 0 },
              end: { x: 400, z: 300 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            },
            {
              id: "south-wall",
              start: { x: 0, z: 300 },
              end: { x: 400, z: 300 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            },
            {
              id: "west-wall",
              start: { x: 0, z: 300 },
              end: { x: 0, z: 0 },
              height: 300,
              thickness: 20,
              roomIds: ["living-room"],
              openings: []
            }
          ],
          staircases: []
        }
      ]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  });
}
