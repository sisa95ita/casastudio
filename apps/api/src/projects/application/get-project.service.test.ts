import { ProjectSchema, type Project } from "@casastudio/schema";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ProjectApiMapper } from "../api/project-api.mapper";
import { PersistedProjectInvalidError, ProjectPersistenceError } from "../persistence/project-persistence-error";
import type { LoadedProject, ProjectsRepository } from "../persistence/project.repository";
import { AuthorizedProjectLoader } from "./authorized-project-loader.service";
import { GetProjectService } from "./get-project.service";
import { ProjectReadAuthorizationPolicy } from "./project-read-authorization.policy";

const canonicalProjectUrl = new URL("../../../../../packages/schema/examples/project.json", import.meta.url);
const canonicalProject = ProjectSchema.parse(JSON.parse(readFileSync(canonicalProjectUrl, "utf8")));
const ownerSubject = "owner-subject";

describe("ProjectReadAuthorizationPolicy", () => {
  const policy = new ProjectReadAuthorizationPolicy();
  const metadata = createLoadedProject(canonicalProject).metadata;

  it("allows casastudio-user only when the subject owns the Project", () => {
    expect(
      policy.canReadProject(
        {
          subject: ownerSubject,
          roles: ["casastudio-user"]
        },
        metadata
      )
    ).toBe(true);
    expect(
      policy.canReadProject(
        {
          subject: "other-subject",
          roles: ["casastudio-user"]
        },
        metadata
      )
    ).toBe(false);
  });

  it("allows casastudio-admin to read non-owned Projects", () => {
    expect(
      policy.canReadProject(
        {
          subject: "admin-subject",
          roles: ["casastudio-admin"]
        },
        metadata
      )
    ).toBe(true);
  });

  it("does not grant owner reads without the casastudio-user role", () => {
    expect(
      policy.canReadProject(
        {
          subject: ownerSubject,
          roles: []
        },
        metadata
      )
    ).toBe(false);
  });
});

describe("GetProjectService", () => {
  it("returns a Project response for the owner and preserves the revision invariant", async () => {
    const service = createService(createRepository({ loadedProject: createLoadedProject(canonicalProject) }));

    const response = await service.getProject(canonicalProject.id, {
      subject: ownerSubject,
      roles: ["casastudio-user"]
    });

    expect(response.project.id).toBe(canonicalProject.id);
    expect(response.sourceRevision).toBe(canonicalProject.revision);
    expect(response.sourceRevision).toBe(response.project.revision);
  });

  it("returns PROJECT_NOT_FOUND for missing Projects", async () => {
    const service = createService(createRepository({ loadedProject: null }));

    await expect(
      service.getProject("missing-project", {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectNotFound,
      status: 404
    });
  });

  it("returns PROJECT_ACCESS_FORBIDDEN for authenticated non-owners", async () => {
    const service = createService(createRepository({ loadedProject: createLoadedProject(canonicalProject) }));

    await expect(
      service.getProject(canonicalProject.id, {
        subject: "other-subject",
        username: "owner-subject",
        email: "owner@example.test",
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectAccessForbidden,
      status: 403
    });
  });

  it("maps invalid persisted state to PROJECT_PERSISTED_STATE_INVALID", async () => {
    const cause = new PersistedProjectInvalidError("bad rows", []);
    const service = createService(createRepository({ error: cause }));

    await expect(
      service.getProject(canonicalProject.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectPersistedStateInvalid,
      cause
    });
  });

  it("maps repository failures to PROJECT_READ_FAILED", async () => {
    const cause = new ProjectPersistenceError("database unavailable");
    const service = createService(createRepository({ error: cause }));

    await expect(
      service.getProject(canonicalProject.id, {
        subject: ownerSubject,
        roles: ["casastudio-user"]
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.ProjectReadFailed,
      cause
    });
  });
});

function createService(repository: ProjectsRepository): GetProjectService {
  return new GetProjectService(
    new AuthorizedProjectLoader(repository, new ProjectReadAuthorizationPolicy()),
    new ProjectApiMapper()
  );
}

function createRepository(input: {
  readonly loadedProject?: LoadedProject | null;
  readonly error?: Error;
}): ProjectsRepository {
  return {
    findByDomainId: vi.fn<ProjectsRepository["findByDomainId"]>(),
    listProjectSummaries: vi.fn<ProjectsRepository["listProjectSummaries"]>(async () => []),
    createProject: vi.fn<ProjectsRepository["createProject"]>(),
    replaceProject: vi.fn<ProjectsRepository["replaceProject"]>(),
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
