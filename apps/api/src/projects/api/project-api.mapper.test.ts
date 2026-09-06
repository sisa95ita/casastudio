import { ProjectSchema } from "@casastudio/schema";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ProjectApiMapper } from "./project-api.mapper";

const canonicalProjectUrl = new URL("../../../../../packages/schema/examples/project.json", import.meta.url);
const canonicalProject = ProjectSchema.parse(JSON.parse(readFileSync(canonicalProjectUrl, "utf8")));

describe("ProjectApiMapper", () => {
  it("round-trips ordered Furniture with unknown definitions and detached positions", () => {
    const project = structuredClone(canonicalProject);
    project.building.furniture = [{ id: "desk", roomId: project.building.levels[0]!.rooms[0]!.id,
      definitionId: "custom-provider:item-123", position: { x: 50, z: 50 }, rotation: -390.5, width: 120, depth: 60, height: 75, name: "Desk", description: "Generic test" }];
    const response = new ProjectApiMapper().toProjectResponse(project);
    expect(ProjectSchema.parse(JSON.parse(JSON.stringify(response.project)))).toEqual(project);
    expect(response.project.building.furniture[0]?.position).not.toBe(project.building.furniture[0]?.position);
  });
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

  it("preserves explicit Door orientation in the authoritative response", () => {
    const project = structuredClone(canonicalProject);
    const door = project.building.levels
      .flatMap((level) => level.walls)
      .flatMap((wall) => wall.openings)
      .find((opening) => opening.type === "DOOR");
    if (!door || door.type !== "DOOR") throw new Error("Canonical fixture requires a Door.");
    door.hingeSide = "END";
    door.swingSide = "RIGHT";

    const response = new ProjectApiMapper().toProjectResponse(ProjectSchema.parse(project));

    expect(response.project.building.levels
      .flatMap((level) => level.walls)
      .flatMap((wall) => wall.openings)
      .find((opening) => opening.id === door.id))
      .toMatchObject({ type: "DOOR", hingeSide: "END", swingSide: "RIGHT" });
  });

  it("preserves free Room boundary geometry without inventing Wall references", () => {
    const project = structuredClone(canonicalProject);
    project.building.levels[0]!.rooms.push({
      id: "elevated-room",
      name: "Elevated Room",
      type: "STUDIO",
      elevation: 180,
      boundary: [
        { kind: "FREE", start: { x: 100, z: 100 }, end: { x: 300, z: 100 } },
        { kind: "FREE", start: { x: 300, z: 100 }, end: { x: 300, z: 250 } },
        { kind: "FREE", start: { x: 300, z: 250 }, end: { x: 100, z: 250 } },
        { kind: "FREE", start: { x: 100, z: 250 }, end: { x: 100, z: 100 } }
      ]
    });

    const response = new ProjectApiMapper().toProjectResponse(ProjectSchema.parse(project));
    const room = response.project.building.levels[0]!.rooms.at(-1)!;

    expect(room.elevation).toBe(180);
    expect(room.boundary).toEqual(project.building.levels[0]!.rooms.at(-1)!.boundary);
    expect(room.boundary.every((edge) => edge.wallId === undefined)).toBe(true);
  });

  it("does not expose persistence ownership or technical database metadata", () => {
    const responseJson = JSON.stringify(new ProjectApiMapper().toProjectResponse(canonicalProject));

    expect(responseJson).not.toContain("ownerSubject");
    expect(responseJson).not.toContain("createdBySubject");
    expect(responseJson).not.toContain("updatedBySubject");
    expect(responseJson).not.toContain('"projectId"');
  });
});
