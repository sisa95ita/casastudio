import { ProjectSchema, type Project } from "./project.js";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "./schema-version.js";

/** Inputs controlled by the application when creating a new Project aggregate. */
export type InitialProjectInput = {
  readonly projectId: string;
  readonly buildingId: string;
  readonly levelId: string;
  readonly name: string;
  readonly createdAt: string;
};

/**
 * Creates the canonical initial state for a new editable Project.
 *
 * New Projects begin at revision one with a single empty Ground Floor at zero
 * elevation. Identifiers and time are supplied by the caller so the factory is
 * deterministic and can be reused by server and tooling contexts.
 */
export function createInitialProject(input: InitialProjectInput): Project {
  return ProjectSchema.parse({
    id: input.projectId,
    name: input.name,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    revision: 1,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    units: {
      length: "cm",
      angle: "deg"
    },
    building: {
      id: input.buildingId,
      name: input.name,
      type: "OTHER",
      levels: [
        {
          id: input.levelId,
          name: "Ground Floor",
          elevation: 0,
          rooms: [],
          walls: [],
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
