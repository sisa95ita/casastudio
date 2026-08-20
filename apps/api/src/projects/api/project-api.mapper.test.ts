import { ProjectSchema } from "@casastudio/schema";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ProjectApiMapper } from "./project-api.mapper";

const canonicalProjectUrl = new URL("../../../../../packages/schema/examples/project.json", import.meta.url);
const canonicalProject = ProjectSchema.parse(JSON.parse(readFileSync(canonicalProjectUrl, "utf8")));

describe("ProjectApiMapper", () => {
  it("derives ownership flags without exposing persistence identity", () => {
    const response = new ProjectApiMapper().toProjectListResponse(
      [
        {
          id: "owned-project",
          name: "Owned Project",
          revision: 1,
          updatedAt: "2026-08-20T12:00:00.000Z",
          ownerSubject: "current-subject"
        },
        {
          id: "admin-visible-project",
          name: "Admin-visible Project",
          revision: 2,
          updatedAt: "2026-08-20T13:00:00.000Z",
          ownerSubject: "another-subject"
        }
      ],
      "current-subject"
    );

    expect(response).toEqual({
      projects: [
        {
          id: "owned-project",
          name: "Owned Project",
          revision: 1,
          updatedAt: "2026-08-20T12:00:00.000Z",
          ownedByCurrentUser: true
        },
        {
          id: "admin-visible-project",
          name: "Admin-visible Project",
          revision: 2,
          updatedAt: "2026-08-20T13:00:00.000Z",
          ownedByCurrentUser: false
        }
      ]
    });
    expect(JSON.stringify(response)).not.toContain("ownerSubject");
  });

  it("maps the complete canonical Project into a fresh response DTO graph", () => {
    const response = new ProjectApiMapper().toProjectResponse(canonicalProject);
    const serializedProject = JSON.parse(JSON.stringify(response.project));

    expect(serializedProject).toEqual(canonicalProject);
    expect(response.sourceRevision).toBe(canonicalProject.revision);
    expect(response.sourceRevision).toBe(response.project.revision);
    expect(response.project).not.toBe(canonicalProject);
    expect(response.project.building).not.toBe(canonicalProject.building);
    expect(response.project.building.levels).not.toBe(canonicalProject.building.levels);
    expect(response.project.building.levels[0]?.rooms[1]?.boundary[0]).toEqual({
      wallId: "living-kitchen-partition",
      direction: "REVERSE"
    });
  });

  it("does not expose persistence ownership or technical database metadata", () => {
    const responseJson = JSON.stringify(new ProjectApiMapper().toProjectResponse(canonicalProject));

    expect(responseJson).not.toContain("ownerSubject");
    expect(responseJson).not.toContain("createdBySubject");
    expect(responseJson).not.toContain("updatedBySubject");
    expect(responseJson).not.toContain('"projectId"');
  });
});
