import { describe, expect, it } from "vitest";

import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency
} from "../validation/index.js";
import { createInitialProject } from "./create-initial-project.js";
import { ProjectSchema } from "./project.js";

describe("createInitialProject", () => {
  it("creates a deterministic canonical editable aggregate with one Ground Floor", () => {
    const input = {
      projectId: "new-project",
      buildingId: "new-building",
      levelId: "ground-floor",
      name: "My apartment",
      createdAt: "2026-08-13T10:00:00.000Z"
    };
    const first = createInitialProject(input);
    const second = createInitialProject(input);

    expect(first).toEqual(second);
    expect(ProjectSchema.safeParse(first).success).toBe(true);
    expect(first).toMatchObject({
      id: "new-project",
      name: "My apartment",
      revision: 1,
      building: {
        name: "My apartment",
        levels: [
          {
            id: "ground-floor",
            name: "Ground Floor",
            elevation: 0,
            rooms: [],
            walls: [],
            staircases: []
          }
        ]
      }
    });
    expect(validateProjectCrossReferences(first).valid).toBe(true);
    expect(validateProjectReferenceConsistency(first).valid).toBe(true);
    expect(validateProjectGeometry(first).valid).toBe(true);
  });
});
