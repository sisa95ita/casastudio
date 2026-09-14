import { z } from "zod";
import {
  CommonMetadataSchema,
  IdentifierSchema,
  Point2DSchema,
  PositiveNumberSchema
} from "../primitives/index.js";
import type { Project } from "../project/project.js";

/** Stable catalog identity, including provider namespaces, independent of Project entity IDs. */
export const FurnitureDefinitionIdSchema = z.string().min(1).regex(/^\S+$/);

/** Broad furnishing semantics resolved through a catalog definition. */
export const FurnitureCategorySchema = z.enum([
  "BED",
  "SOFA",
  "TABLE",
  "CHAIR",
  "CABINET",
  "DESK",
  "GENERIC"
]);

/** Product catalog contract; defaults are centimeters and are copied only at creation. */
export const FurnitureDefinitionSchema = z.strictObject({
  id: FurnitureDefinitionIdSchema,
  category: FurnitureCategorySchema,
  name: z.string().min(1),
  defaultWidth: PositiveNumberSchema,
  defaultDepth: PositiveNumberSchema,
  defaultHeight: PositiveNumberSchema
});

/** A product definition outside the Project aggregate, with no renderer or asset dependency. */
export type FurnitureDefinition = z.infer<typeof FurnitureDefinitionSchema>;

/**
 * One Room-owned furnishing. Position is the footprint center in Project X/Z centimeters.
 * Width spans local X, depth spans local Z; rotation is arbitrary finite degrees about
 * positive Y using the right-hand rule, without normalization. Height extends upwards
 * from the owning Room's floor. Effective dimensions and optional name/description
 * belong to the instance. Catalog availability and geometric containment are not parsing constraints.
 */
export const FurnitureItemSchema = z.strictObject({
  ...CommonMetadataSchema.shape,
  roomId: IdentifierSchema,
  definitionId: FurnitureDefinitionIdSchema,
  position: Point2DSchema.strict(),
  rotation: z.number(),
  width: PositiveNumberSchema,
  depth: PositiveNumberSchema,
  height: PositiveNumberSchema
});

/** Canonical persisted furnishing with exactly one mandatory Room reference and no Y or Level ownership. */
export type FurnitureItem = z.infer<typeof FurnitureItemSchema>;

/**
 * Resolves the owning Room and Level and its global floor elevation without catalog or geometry loading.
 * Returns undefined for a missing or ambiguous Room identity; semantic validation rejects either case.
 */
export function resolveFurnitureRoom(
  project: Project,
  item: Pick<FurnitureItem, "roomId">
) {
  const matches = project.building.levels.flatMap((level) =>
    level.rooms
      .filter((room) => room.id === item.roomId)
      .map((room) => ({
        room,
        level,
        floorElevation: level.elevation + (room.elevation ?? 0)
      }))
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Creates a detached instance from explicitly supplied catalog defaults and caller-owned identity. */
export function createFurnitureItemFromDefinition(
  definition: FurnitureDefinition,
  input: Pick<FurnitureItem, "id" | "roomId" | "position"> &
    Partial<Pick<FurnitureItem, "rotation" | "name" | "description">>
): FurnitureItem {
  const parsed = FurnitureDefinitionSchema.parse(definition);
  return FurnitureItemSchema.parse({
    ...input,
    definitionId: parsed.id,
    rotation: input.rotation ?? 0,
    width: parsed.defaultWidth,
    depth: parsed.defaultDepth,
    height: parsed.defaultHeight
  });
}
