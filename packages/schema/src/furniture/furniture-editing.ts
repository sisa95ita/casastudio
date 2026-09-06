import { ProjectSchema, type Project } from "../project/project.js";
import { IdentifierSchema, type Point2D } from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectIdentifierUniqueness,
  validateProjectReferenceConsistency,
  validateProjectGeometry,
  ValidationErrorCode
} from "../validation/index.js";
import type { ProjectEditingResult } from "../physical-building/wall-editing.js";
import { FurnitureItemSchema, type FurnitureItem } from "./furniture.js";

/** Editable instance properties; stable identity cannot be updated. */
export type UpdateFurnitureProperties = Partial<Omit<FurnitureItem, "id">>;

/** Places a complete furnishing using caller-supplied identity and effective dimensions. */
export function createFurniture(
  project: Project,
  input: { readonly furniture: FurnitureItem }
): ProjectEditingResult {
  if (!IdentifierSchema.safeParse(input.furniture.id).success)
    return failure(
      ValidationErrorCode.INVALID_IDENTIFIER,
      "furniture.id",
      "Invalid Furniture identifier."
    );
  if (project.building.furniture.some((item) => item.id === input.furniture.id))
    return failure(
      ValidationErrorCode.DUPLICATE_IDENTIFIER,
      "furniture.id",
      "Furniture identifier is already in use."
    );
  const parsed = FurnitureItemSchema.safeParse(input.furniture);
  if (!parsed.success)
    return failure(
      ValidationErrorCode.INVALID_FURNITURE,
      "furniture",
      "Furniture properties violate the canonical contract."
    );
  return replaceFurniture(project, [
    ...project.building.furniture,
    parsed.data
  ]);
}

/** Updates effective properties immutably while preserving the stable instance ID. */
export function updateFurniture(
  project: Project,
  input: {
    readonly furnitureId: string;
    readonly changes: UpdateFurnitureProperties;
  }
): ProjectEditingResult {
  const error = requireFurniture(project, input.furnitureId);
  if (error) return error;
  const current = project.building.furniture.find(
    (item) => item.id === input.furnitureId
  )!;
  const parsed = FurnitureItemSchema.safeParse({
    ...current,
    ...input.changes,
    id: current.id
  });
  if (!parsed.success)
    return failure(
      ValidationErrorCode.INVALID_FURNITURE,
      "furniture",
      "Furniture properties violate the canonical contract."
    );
  return replaceFurniture(
    project,
    project.building.furniture.map((item) =>
      item.id === current.id ? parsed.data : item
    )
  );
}

/** Moves only the footprint center in Project X/Z coordinates. */
export function moveFurniture(
  project: Project,
  input: { readonly furnitureId: string; readonly position: Point2D }
): ProjectEditingResult {
  return updateFurniture(project, {
    furnitureId: input.furnitureId,
    changes: { position: input.position }
  });
}

/** Sets arbitrary finite canonical degrees without angle normalization. */
export function rotateFurniture(
  project: Project,
  input: { readonly furnitureId: string; readonly rotation: number }
): ProjectEditingResult {
  return updateFurniture(project, {
    furnitureId: input.furnitureId,
    changes: { rotation: input.rotation }
  });
}

/** Replaces all effective dimensions in centimeters, independently of catalog defaults. */
export function resizeFurniture(
  project: Project,
  input: {
    readonly furnitureId: string;
    readonly width: number;
    readonly depth: number;
    readonly height: number;
  }
): ProjectEditingResult {
  return updateFurniture(project, {
    furnitureId: input.furnitureId,
    changes: { width: input.width, depth: input.depth, height: input.height }
  });
}

/** Reassigns the owning Room, optionally moving X/Z; vertical placement follows the new Room. */
export function reassignFurniture(
  project: Project,
  input: {
    readonly furnitureId: string;
    readonly roomId: string;
    readonly position?: Point2D;
  }
): ProjectEditingResult {
  return updateFurniture(project, {
    furnitureId: input.furnitureId,
    changes: {
      roomId: input.roomId,
      ...(input.position === undefined ? {} : { position: input.position })
    }
  });
}

/** Removes only the requested instance, retaining the order of all remaining items. */
export function deleteFurniture(
  project: Project,
  input: { readonly furnitureId: string }
): ProjectEditingResult {
  const error = requireFurniture(project, input.furnitureId);
  return (
    error ??
    replaceFurniture(
      project,
      project.building.furniture.filter((item) => item.id !== input.furnitureId)
    )
  );
}

/** Copies effective properties and metadata to a caller-owned new ID and explicit target position. */
export function duplicateFurniture(
  project: Project,
  input: {
    readonly furnitureId: string;
    readonly newId: string;
    readonly position: Point2D;
    readonly roomId?: string;
  }
): ProjectEditingResult {
  const error = requireFurniture(project, input.furnitureId);
  if (error) return error;
  const source = project.building.furniture.find(
    (item) => item.id === input.furnitureId
  )!;
  return createFurniture(project, {
    furniture: {
      ...source,
      id: input.newId,
      position: input.position,
      roomId: input.roomId ?? source.roomId
    }
  });
}

function requireFurniture(
  project: Project,
  id: string
): ProjectEditingResult | undefined {
  if (!IdentifierSchema.safeParse(id).success)
    return failure(
      ValidationErrorCode.INVALID_IDENTIFIER,
      "furnitureId",
      "Invalid Furniture identifier."
    );
  if (!project.building.furniture.some((item) => item.id === id))
    return failure(
      ValidationErrorCode.FURNITURE_NOT_FOUND,
      "furnitureId",
      `Furniture "${id}" could not be found.`
    );
  return undefined;
}

function replaceFurniture(
  project: Project,
  furniture: FurnitureItem[]
): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse({
    ...project,
    building: { ...project.building, furniture }
  });
  if (!parsed.success)
    return failure(
      ValidationErrorCode.INVALID_FURNITURE,
      "furniture",
      "Furniture edit produced invalid Project structure."
    );
  for (const validate of [
    validateProjectIdentifierUniqueness,
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ]) {
    const result = validate(parsed.data);
    if (!result.valid) return { ok: false, errors: result.errors };
  }
  return { ok: true, project: parsed.data };
}

function failure(
  code: ValidationErrorCode,
  path: string,
  message: string
): ProjectEditingResult {
  return { ok: false, errors: [{ code, path, message }] };
}
