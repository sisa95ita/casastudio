import { z } from "zod";
import {
  FurnitureCommandsSchema,
  IdentifierSchema,
  Point2DSchema,
  builtinFurnitureDefinitions,
  deriveDirectRoomConnections,
  isFreeRoomBoundaryEdge,
  type FurnitureItem,
  type Project
} from "@casastudio/schema";
import {
  applyFurnitureCommands,
  furnitureRoomCandidates
} from "@casastudio/geometry";
import { DesignGenerationError } from "./failures.js";

export const FurnitureEditRequestSchema = z.strictObject({
  instructions: z.string().trim().min(1).max(2000),
  baseRevision: z.number().int().positive(),
  levelId: IdentifierSchema,
  roomId: IdentifierSchema.optional(),
  selectedFurnitureIds: z.array(IdentifierSchema).max(8),
  placementHint: z
    .strictObject({
      roomId: IdentifierSchema,
      position: Point2DSchema.strict()
    })
    .optional()
});
export type FurnitureEditRequest = z.infer<typeof FurnitureEditRequestSchema>;

/** Provider output carries no provider metadata, new entity IDs, assets, or dimensions. */
export const FurnitureEditResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("EDIT_PROPOSAL"),
    operations: FurnitureCommandsSchema
  }),
  z.strictObject({
    kind: z.literal("CLARIFICATION_REQUIRED"),
    message: z.string().min(1).max(1000)
  }),
  z.strictObject({
    kind: z.literal("UNSUPPORTED_REQUEST"),
    message: z.string().min(1).max(1000)
  })
]);
export type FurnitureEditResult = z.infer<typeof FurnitureEditResultSchema>;
export const FurnitureEditResponseSchema = z.strictObject({
  projectId: IdentifierSchema,
  projectRevision: z.number().int().positive(),
  result: FurnitureEditResultSchema
});
export type FurnitureEditResponse = z.infer<typeof FurnitureEditResponseSchema>;

export type FurnitureEditContext = ReturnType<
  typeof deriveFurnitureEditContext
>;
export interface FurnitureEditProvider {
  readonly name: string;
  interpretFurnitureEdit(request: {
    instructions: string;
    context: FurnitureEditContext;
  }): Promise<unknown>;
}

function invalid(message: string): never {
  throw new DesignGenerationError("unsupported_target", message);
}

/** Only IDs verified against persisted, authorized canonical state enter provider context. */
export function deriveFurnitureEditContext(
  project: Project,
  request: FurnitureEditRequest
) {
  if (project.revision !== request.baseRevision)
    throw new DesignGenerationError(
      "stale_context",
      "Save or reload the current Project before requesting an edit."
    );
  const level = project.building.levels.find(
    (item) => item.id === request.levelId
  );
  if (!level) invalid("Active Level could not be found.");
  if (request.roomId && !level.rooms.some((room) => room.id === request.roomId))
    invalid("Active Room does not belong to the active Level.");
  const selected = request.selectedFurnitureIds.map((id) => {
    const item = project.building.furniture.find((entry) => entry.id === id);
    if (!item || !level.rooms.some((room) => room.id === item.roomId))
      invalid("Selected Furniture does not belong to the active Level.");
    return item;
  });
  const roomIds = new Set(selected.map((item) => item.roomId));
  if (request.roomId) roomIds.add(request.roomId);
  if (request.placementHint) {
    if (
      !furnitureRoomCandidates(
        project,
        level.id,
        request.placementHint.position
      ).some((room) => room.roomId === request.placementHint!.roomId)
    )
      invalid("Placement anchor must be inside its Room on the active Level.");
    roomIds.add(request.placementHint.roomId);
  }
  const furniture = project.building.furniture.filter((item) =>
    roomIds.has(item.roomId)
  );
  if (
    level.rooms.length > 16 ||
    furniture.length > 100 ||
    level.rooms.reduce((total, room) => total + room.boundary.length, 0) > 1024
  )
    invalid(
      "This context is too large. Furniture editing supports up to 16 destination Rooms, 100 relevant items and 1024 boundary segments."
    );
  const summary = (item: FurnitureItem) => ({
    id: item.id,
    name: item.name,
    definitionId: item.definitionId,
    category: builtinFurnitureDefinitions.find(
      (definition) => definition.id === item.definitionId
    )?.category,
    roomId: item.roomId,
    position: { ...item.position },
    rotation: item.rotation,
    width: item.width,
    depth: item.depth,
    height: item.height
  });
  return {
    projectId: project.id,
    projectRevision: project.revision,
    coordinates:
      "Project X/Z in centimeters; position is footprint center. Rotation in degrees about positive Y, right-hand rule (positive rotation turns +X toward -Z). Angles remain arbitrary finite degrees, as in the manual editor.",
    level: { id: level.id, name: level.name, elevation: level.elevation },
    activeRoomId: request.roomId,
    selectedFurniture: selected.map(summary),
    furniture: furniture.map(summary),
    rooms: level.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      floorElevation: level.elevation + (room.elevation ?? 0),
      connectedRoomIds: deriveDirectRoomConnections(level, room.id).map(
        (connection) => connection.roomId
      ),
      boundary: room.boundary.map((edge) => {
        if (isFreeRoomBoundaryEdge(edge)) return { ...edge.start };
        const wall = level.walls.find((entry) => entry.id === edge.wallId)!;
        return { ...(edge.direction === "FORWARD" ? wall.start : wall.end) };
      })
    })),
    placementHint: request.placementHint,
    catalog: builtinFurnitureDefinitions.map((definition) => ({
      ...definition
    }))
  };
}

/** Validate both provider structure and its authority before showing a proposal. */
export function validateFurnitureEditResult(
  project: Project,
  context: FurnitureEditContext,
  raw: unknown
): FurnitureEditResult {
  const parsed = FurnitureEditResultSchema.safeParse(raw);
  if (!parsed.success)
    throw new DesignGenerationError(
      "invalid_provider_response",
      "Malformed Furniture edit result."
    );
  const result = parsed.data;
  if (result.kind !== "EDIT_PROPOSAL") return result;
  try {
    for (const operation of result.operations) {
      if ("furnitureId" in operation) {
        if (
          !context.furniture.some((item) => item.id === operation.furnitureId)
        )
          throw new Error(
            "Provider referenced Furniture outside the supplied context."
          );
        if (
          context.selectedFurniture.length &&
          !context.selectedFurniture.some(
            (item) => item.id === operation.furnitureId
          )
        )
          throw new Error("Provider ignored explicit Furniture selection.");
      }
      const targetRoom =
        operation.type === "ADD_FURNITURE"
          ? operation.roomId
          : operation.type === "TRANSFER_FURNITURE"
            ? operation.targetRoomId
            : undefined;
      if (targetRoom && !context.rooms.some((room) => room.id === targetRoom))
        throw new Error("Provider referenced a Room outside the active Level.");
      if (operation.type === "ADD_FURNITURE") {
        if (
          !context.catalog.some(
            (definition) => definition.id === operation.definitionId
          )
        )
          throw new Error("Provider invented a catalog definition.");
        if (
          context.placementHint &&
          (operation.roomId !== context.placementHint.roomId ||
            operation.position.x !== context.placementHint.position.x ||
            operation.position.z !== context.placementHint.position.z)
        )
          throw new Error(
            "Provider did not respect the explicit placement anchor."
          );
      }
    }
    let index = 0;
    applyFurnitureCommands(project, result.operations, () => {
      let id: string;
      do {
        id = `furniture-validation-${index++}`;
      } while (project.building.furniture.some((item) => item.id === id));
      return id;
    });
  } catch (error) {
    throw new DesignGenerationError(
      "invalid_provider_response",
      error instanceof Error ? error.message : "Invalid Furniture edit."
    );
  }
  return result;
}
