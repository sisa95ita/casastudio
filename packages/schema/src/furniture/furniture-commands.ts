import { z } from "zod";
import { IdentifierSchema, Point2DSchema } from "../primitives/index.js";
import { FurnitureDefinitionIdSchema } from "./furniture.js";

/** Commands describe canonical intent. Identity for additions is allocated by the caller. */
export const FurnitureCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("MOVE_FURNITURE"),
    furnitureId: IdentifierSchema,
    targetPosition: Point2DSchema.strict()
  }),
  z.strictObject({
    type: z.literal("ROTATE_FURNITURE"),
    furnitureId: IdentifierSchema,
    targetRotation: z.number()
  }),
  z.strictObject({
    type: z.literal("ADD_FURNITURE"),
    definitionId: FurnitureDefinitionIdSchema,
    roomId: IdentifierSchema,
    position: Point2DSchema.strict(),
    rotation: z.number()
  }),
  z.strictObject({
    type: z.literal("TRANSFER_FURNITURE"),
    furnitureId: IdentifierSchema,
    targetRoomId: IdentifierSchema,
    targetPosition: Point2DSchema.strict(),
    targetRotation: z.number().optional()
  })
]);

export const furnitureCommandLimit = 8;
export const FurnitureCommandsSchema = z
  .array(FurnitureCommandSchema)
  .min(1)
  .max(furnitureCommandLimit);
export type FurnitureCommand = z.infer<typeof FurnitureCommandSchema>;
