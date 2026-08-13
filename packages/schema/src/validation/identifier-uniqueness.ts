import type { Project } from "../project/index.js";
import { ValidationErrorCode } from "./validation-error-code.js";
import type { ValidationError, ValidationResult } from "./validation-result.js";

type IdentifiedPath = {
  readonly id: string;
  readonly path: string;
};

/**
 * Validates identifier uniqueness for entity kinds persisted under one Project.
 *
 * The scopes mirror normalized persistence keys: Levels, Rooms, Walls,
 * Openings, Staircases, Flights, and Landings are unique per Project within
 * their own kind, as are each top-level observation and rendering entity kind.
 */
export function validateProjectIdentifierUniqueness(project: Project): ValidationResult {
  const errors: ValidationError[] = [];
  const levels: IdentifiedPath[] = [];
  const rooms: IdentifiedPath[] = [];
  const walls: IdentifiedPath[] = [];
  const openings: IdentifiedPath[] = [];
  const staircases: IdentifiedPath[] = [];
  const flights: IdentifiedPath[] = [];
  const landings: IdentifiedPath[] = [];

  project.building.levels.forEach((level, levelIndex) => {
    const levelPath = `building.levels[${levelIndex}]`;
    levels.push({ id: level.id, path: `${levelPath}.id` });

    level.rooms.forEach((room, roomIndex) => {
      rooms.push({ id: room.id, path: `${levelPath}.rooms[${roomIndex}].id` });
    });
    level.walls.forEach((wall, wallIndex) => {
      const wallPath = `${levelPath}.walls[${wallIndex}]`;
      walls.push({ id: wall.id, path: `${wallPath}.id` });
      wall.openings.forEach((opening, openingIndex) => {
        openings.push({ id: opening.id, path: `${wallPath}.openings[${openingIndex}].id` });
      });
    });
    level.staircases.forEach((staircase, staircaseIndex) => {
      const staircasePath = `${levelPath}.staircases[${staircaseIndex}]`;
      staircases.push({ id: staircase.id, path: `${staircasePath}.id` });
      staircase.flights.forEach((flight, flightIndex) => {
        flights.push({ id: flight.id, path: `${staircasePath}.flights[${flightIndex}].id` });
      });
      staircase.landings.forEach((landing, landingIndex) => {
        landings.push({ id: landing.id, path: `${staircasePath}.landings[${landingIndex}].id` });
      });
    });
  });

  const categories: readonly [string, readonly IdentifiedPath[]][] = [
    ["Level", levels],
    ["Room", rooms],
    ["Wall", walls],
    ["Opening", openings],
    ["Staircase", staircases],
    ["StairFlight", flights],
    ["StairLanding", landings],
    ["Viewpoint", topLevelPaths(project.viewpoints, "viewpoints")],
    ["BaseImage", topLevelPaths(project.baseImages, "baseImages")],
    ["DesignBrief", topLevelPaths(project.designBriefs, "designBriefs")],
    ["RenderRequest", topLevelPaths(project.renderRequests, "renderRequests")],
    ["RenderResult", topLevelPaths(project.renderResults, "renderResults")]
  ];

  for (const [entityName, entries] of categories) {
    collectDuplicateErrors(errors, entityName, entries);
  }

  return { valid: errors.length === 0, errors };
}

function topLevelPaths(items: readonly { readonly id: string }[], path: string): IdentifiedPath[] {
  return items.map((item, index) => ({ id: item.id, path: `${path}[${index}].id` }));
}

function collectDuplicateErrors(
  errors: ValidationError[],
  entityName: string,
  entries: readonly IdentifiedPath[]
): void {
  const firstPathById = new Map<string, string>();

  for (const entry of entries) {
    const firstPath = firstPathById.get(entry.id);
    if (!firstPath) {
      firstPathById.set(entry.id, entry.path);
      continue;
    }

    errors.push({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: entry.path,
      message: `${entityName} identifier "${entry.id}" duplicates ${firstPath}.`
    });
  }
}
